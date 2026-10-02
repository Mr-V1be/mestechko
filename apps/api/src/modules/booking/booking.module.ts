import { Module } from '@nestjs/common';
import type { Clock } from '@mestechko/domain';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { AVATAR_URLS, type AvatarUrls } from '../../shared/application/avatar-urls.js';
import { CLOCK, ID_GENERATOR, type IdGenerator } from '../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.js';
import { CATALOG_READER, type CatalogReader } from '../catalog/application/catalog-reader.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import {
  CLIENT_DIRECTORY,
  CUSTOMER_IDENTITIES,
  type ClientDirectory,
  type CustomerIdentities,
} from '../clients/application/ports.js';
import { ClientsModule } from '../clients/clients.module.js';
import { MediaModule } from '../media/media.module.js';
import { WORK_CALENDAR_READER, type WorkCalendarReader } from '../scheduling/application/ports.js';
import { ProductionCalendars } from '../scheduling/application/production-calendars.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { BusinessContextResolver } from '../tenancy/application/business-context.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { BookingOptionsController } from './api/booking-options.controller.js';
import { CabinetBookingsController } from './api/cabinet-bookings.controller.js';
import { MiniAppBookingsController } from './api/miniapp-bookings.controller.js';
import { AvailabilityAssembler } from './application/availability/availability-assembler.js';
import { BookingOptions } from './application/availability/booking-options.js';
import { CabinetBookings } from './application/cabinet/cabinet-bookings.js';
import {
  CABINET_BOOKING_QUERIES,
  type CabinetBookingQueries,
} from './application/cabinet/ports.js';
import { ScheduleView } from './application/cabinet/schedule-view.js';
import { ClientBookings } from './application/client/client-bookings.js';
import { CreateClientBooking } from './application/client/create-client-booking.js';
import {
  BOOKING_TELEMETRY,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  OCCUPANCY_READER,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
  type OccupancyReader,
} from './application/ports.js';
import { KyselyBookingWriter } from './infrastructure/kysely-booking-writer.js';
import { KyselyCabinetBookingQueries } from './infrastructure/kysely-cabinet-booking-queries.js';
import { KyselyClientBookingQueries } from './infrastructure/kysely-client-booking-queries.js';
import { KyselyOccupancyReader } from './infrastructure/kysely-occupancy-reader.js';
import { OtelBookingTelemetry } from './infrastructure/otel-booking-telemetry.js';

const kysely = <T>(build: (unitOfWork: KyselyUnitOfWork) => T) => ({
  useFactory: build,
  inject: [KyselyUnitOfWork],
});

@Module({
  imports: [TenancyModule, CatalogModule, SchedulingModule, ClientsModule, MediaModule],
  controllers: [BookingOptionsController, MiniAppBookingsController, CabinetBookingsController],
  providers: [
    { provide: OCCUPANCY_READER, ...kysely((unitOfWork) => new KyselyOccupancyReader(unitOfWork)) },
    { provide: BOOKING_WRITER, ...kysely((unitOfWork) => new KyselyBookingWriter(unitOfWork)) },
    {
      provide: CLIENT_BOOKING_QUERIES,
      ...kysely((unitOfWork) => new KyselyClientBookingQueries(unitOfWork)),
    },
    {
      provide: CABINET_BOOKING_QUERIES,
      ...kysely((unitOfWork) => new KyselyCabinetBookingQueries(unitOfWork)),
    },
    { provide: BOOKING_TELEMETRY, useFactory: () => new OtelBookingTelemetry() },
    {
      provide: AvailabilityAssembler,
      useFactory: (
        catalog: CatalogReader,
        workCalendars: WorkCalendarReader,
        calendars: ProductionCalendars,
        occupancies: OccupancyReader,
      ) => new AvailabilityAssembler(catalog, workCalendars, calendars, occupancies),
      inject: [CATALOG_READER, WORK_CALENDAR_READER, ProductionCalendars, OCCUPANCY_READER],
    },
    {
      provide: BookingOptions,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        catalog: CatalogReader,
        workCalendars: WorkCalendarReader,
        assembler: AvailabilityAssembler,
        avatars: AvatarUrls,
        clock: Clock,
      ) =>
        new BookingOptions(
          businesses,
          unitOfWork,
          catalog,
          workCalendars,
          assembler,
          avatars,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CATALOG_READER,
        WORK_CALENDAR_READER,
        AvailabilityAssembler,
        AVATAR_URLS,
        CLOCK,
      ],
    },
    {
      provide: CreateClientBooking,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        catalog: CatalogReader,
        customers: CustomerIdentities,
        clients: ClientDirectory,
        assembler: AvailabilityAssembler,
        writer: BookingWriter,
        queries: ClientBookingQueries,
        telemetry: BookingTelemetry,
        avatars: AvatarUrls,
        ids: IdGenerator,
        clock: Clock,
      ) =>
        new CreateClientBooking(
          businesses,
          unitOfWork,
          catalog,
          customers,
          clients,
          assembler,
          writer,
          queries,
          telemetry,
          avatars,
          ids,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CATALOG_READER,
        CUSTOMER_IDENTITIES,
        CLIENT_DIRECTORY,
        AvailabilityAssembler,
        BOOKING_WRITER,
        CLIENT_BOOKING_QUERIES,
        BOOKING_TELEMETRY,
        AVATAR_URLS,
        ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: ClientBookings,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        customers: CustomerIdentities,
        clients: ClientDirectory,
        queries: ClientBookingQueries,
        avatars: AvatarUrls,
        clock: Clock,
      ) => new ClientBookings(businesses, unitOfWork, customers, clients, queries, avatars, clock),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CUSTOMER_IDENTITIES,
        CLIENT_DIRECTORY,
        CLIENT_BOOKING_QUERIES,
        AVATAR_URLS,
        CLOCK,
      ],
    },
    {
      provide: ScheduleView,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        catalog: CatalogReader,
        workCalendars: WorkCalendarReader,
        calendars: ProductionCalendars,
        queries: CabinetBookingQueries,
        avatars: AvatarUrls,
      ) =>
        new ScheduleView(
          businesses,
          unitOfWork,
          catalog,
          workCalendars,
          calendars,
          queries,
          avatars,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CATALOG_READER,
        WORK_CALENDAR_READER,
        ProductionCalendars,
        CABINET_BOOKING_QUERIES,
        AVATAR_URLS,
      ],
    },
    {
      provide: CabinetBookings,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        catalog: CatalogReader,
        queries: CabinetBookingQueries,
        avatars: AvatarUrls,
      ) => new CabinetBookings(businesses, unitOfWork, catalog, queries, avatars),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CATALOG_READER,
        CABINET_BOOKING_QUERIES,
        AVATAR_URLS,
      ],
    },
  ],
})
export class BookingModule {}

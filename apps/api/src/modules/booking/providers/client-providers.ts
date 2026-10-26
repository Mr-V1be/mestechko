import type { Provider } from '@nestjs/common';
import type { Clock } from '@slotwise/domain';
import { AVATAR_URLS, type AvatarUrls } from '../../../shared/application/avatar-urls.js';
import { CLOCK, ID_GENERATOR, type IdGenerator } from '../../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { CATALOG_READER, type CatalogReader } from '../../catalog/application/catalog-reader.js';
import {
  CLIENT_DIRECTORY,
  CUSTOMER_IDENTITIES,
  type ClientDirectory,
  type CustomerIdentities,
} from '../../clients/application/ports.js';
import { Prepayments } from '../../payments/application/prepayments.js';
import {
  WORK_CALENDAR_READER,
  type WorkCalendarReader,
} from '../../scheduling/application/ports.js';
import { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { AvailabilityAssembler } from '../application/availability/availability-assembler.js';
import { BookingOptions } from '../application/availability/booking-options.js';
import { BookingPlacement } from '../application/client/booking-placement.js';
import { ClientBookingPresenter } from '../application/client/client-booking-presenter.js';
import { ClientBookings } from '../application/client/client-bookings.js';
import { CreateClientBooking } from '../application/client/create-client-booking.js';
import { BookingNotifier } from '../application/lifecycle/booking-notifier.js';
import { RescheduleOptions } from '../application/lifecycle/reschedule-options.js';
import {
  BOOKING_FOLLOW_UPS,
  BOOKING_TELEMETRY,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  OCCUPANCY_READER,
  type BookingFollowUps,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
  type OccupancyReader,
} from '../application/ports.js';

/** What clients can book, booking it, and reading their own bookings. */
export const clientBookingProviders: Provider[] = [
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
      new BookingOptions(businesses, unitOfWork, catalog, workCalendars, assembler, avatars, clock),
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
    provide: BookingPlacement,
    useFactory: (
      catalog: CatalogReader,
      assembler: AvailabilityAssembler,
      writer: BookingWriter,
      queries: ClientBookingQueries,
      prepayments: Prepayments,
      telemetry: BookingTelemetry,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new BookingPlacement(catalog, assembler, writer, queries, prepayments, telemetry, ids, clock),
    inject: [
      CATALOG_READER,
      AvailabilityAssembler,
      BOOKING_WRITER,
      CLIENT_BOOKING_QUERIES,
      Prepayments,
      BOOKING_TELEMETRY,
      ID_GENERATOR,
      CLOCK,
    ],
  },
  {
    provide: ClientBookingPresenter,
    useFactory: (
      queries: ClientBookingQueries,
      prepayments: Prepayments,
      avatars: AvatarUrls,
      clock: Clock,
    ) => new ClientBookingPresenter(queries, prepayments, avatars, clock),
    inject: [CLIENT_BOOKING_QUERIES, Prepayments, AVATAR_URLS, CLOCK],
  },
  {
    provide: CreateClientBooking,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      customers: CustomerIdentities,
      clients: ClientDirectory,
      placement: BookingPlacement,
      notifier: BookingNotifier,
      followUps: BookingFollowUps,
      presenter: ClientBookingPresenter,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new CreateClientBooking(
        businesses,
        unitOfWork,
        customers,
        clients,
        placement,
        notifier,
        followUps,
        presenter,
        ids,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      BookingPlacement,
      BookingNotifier,
      BOOKING_FOLLOW_UPS,
      ClientBookingPresenter,
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
      presenter: ClientBookingPresenter,
      clock: Clock,
    ) => new ClientBookings(businesses, unitOfWork, customers, clients, queries, presenter, clock),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      CLIENT_BOOKING_QUERIES,
      ClientBookingPresenter,
      CLOCK,
    ],
  },
  {
    provide: RescheduleOptions,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      customers: CustomerIdentities,
      clients: ClientDirectory,
      queries: ClientBookingQueries,
      assembler: AvailabilityAssembler,
      clock: Clock,
    ) =>
      new RescheduleOptions(businesses, unitOfWork, customers, clients, queries, assembler, clock),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      CLIENT_BOOKING_QUERIES,
      AvailabilityAssembler,
      CLOCK,
    ],
  },
];

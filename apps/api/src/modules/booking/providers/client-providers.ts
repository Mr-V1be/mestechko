import type { Provider } from '@nestjs/common';
import type { Clock } from '@mestechko/domain';
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
import {
  NOTIFICATION_OUTBOX,
  type NotificationOutbox,
} from '../../notifications/application/ports.js';
import {
  WORK_CALENDAR_READER,
  type WorkCalendarReader,
} from '../../scheduling/application/ports.js';
import { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { AvailabilityAssembler } from '../application/availability/availability-assembler.js';
import { BookingOptions } from '../application/availability/booking-options.js';
import { ClientBookings } from '../application/client/client-bookings.js';
import { CreateClientBooking } from '../application/client/create-client-booking.js';
import { BookingNotifier } from '../application/lifecycle/booking-notifier.js';
import { ClientBookingChanges } from '../application/lifecycle/client-booking-changes.js';
import {
  BOOKING_LIFECYCLE_STORE,
  type BookingLifecycleStore,
} from '../application/lifecycle/ports.js';
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

/** Use cases of clients: what is bookable, booking, and changing their own bookings. */
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
    provide: BookingNotifier,
    useFactory: (outbox: NotificationOutbox) => new BookingNotifier(outbox),
    inject: [NOTIFICATION_OUTBOX],
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
      notifier: BookingNotifier,
      followUps: BookingFollowUps,
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
        notifier,
        followUps,
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
      BookingNotifier,
      BOOKING_FOLLOW_UPS,
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
    provide: ClientBookingChanges,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      customers: CustomerIdentities,
      clients: ClientDirectory,
      store: BookingLifecycleStore,
      assembler: AvailabilityAssembler,
      queries: ClientBookingQueries,
      notifier: BookingNotifier,
      followUps: BookingFollowUps,
      avatars: AvatarUrls,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new ClientBookingChanges(
        businesses,
        unitOfWork,
        customers,
        clients,
        store,
        assembler,
        queries,
        notifier,
        followUps,
        avatars,
        ids,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CUSTOMER_IDENTITIES,
      CLIENT_DIRECTORY,
      BOOKING_LIFECYCLE_STORE,
      AvailabilityAssembler,
      CLIENT_BOOKING_QUERIES,
      BookingNotifier,
      BOOKING_FOLLOW_UPS,
      AVATAR_URLS,
      ID_GENERATOR,
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

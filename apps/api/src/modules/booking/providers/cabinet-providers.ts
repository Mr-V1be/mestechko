import type { Provider } from '@nestjs/common';
import type { Clock } from '@mestechko/domain';
import { AVATAR_URLS, type AvatarUrls } from '../../../shared/application/avatar-urls.js';
import { CLOCK, ID_GENERATOR, type IdGenerator } from '../../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../shared/application/unit-of-work.js';
import { CATALOG_READER, type CatalogReader } from '../../catalog/application/catalog-reader.js';
import {
  CLIENT_DIRECTORY,
  MESSENGER_CONTACTS,
  type ClientDirectory,
  type MessengerContacts,
} from '../../clients/application/ports.js';
import { LEDGER_STORE, type LedgerStore } from '../../loyalty/application/ports.js';
import { VisitSettlements } from '../../loyalty/application/visit-settlements.js';
import { Prepayments } from '../../payments/application/prepayments.js';
import {
  WORK_CALENDAR_READER,
  type WorkCalendarReader,
} from '../../scheduling/application/ports.js';
import { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import { AvailabilityAssembler } from '../application/availability/availability-assembler.js';
import { BusinessBookingChanges } from '../application/cabinet/business-booking-changes.js';
import { CabinetBookings } from '../application/cabinet/cabinet-bookings.js';
import {
  CABINET_BOOKING_QUERIES,
  type CabinetBookingQueries,
} from '../application/cabinet/ports.js';
import { ScheduleView } from '../application/cabinet/schedule-view.js';
import { BookingCancellation } from '../application/lifecycle/booking-cancellation.js';
import { BookingNotifier } from '../application/lifecycle/booking-notifier.js';
import {
  BOOKING_LIFECYCLE_STORE,
  type BookingLifecycleStore,
} from '../application/lifecycle/ports.js';
import {
  BOOKING_FOLLOW_UPS,
  BOOKING_TELEMETRY,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  type BookingFollowUps,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
} from '../application/ports.js';

/** Use cases of the business cabinet: the schedule, the bookings and the front desk. */
export const cabinetBookingProviders: Provider[] = [
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
      new ScheduleView(businesses, unitOfWork, catalog, workCalendars, calendars, queries, avatars),
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
      prepayments: Prepayments,
      ledger: LedgerStore,
      contacts: MessengerContacts,
      avatars: AvatarUrls,
      clock: Clock,
    ) =>
      new CabinetBookings(
        businesses,
        unitOfWork,
        catalog,
        queries,
        prepayments,
        ledger,
        contacts,
        avatars,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      CATALOG_READER,
      CABINET_BOOKING_QUERIES,
      Prepayments,
      LEDGER_STORE,
      MESSENGER_CONTACTS,
      AVATAR_URLS,
      CLOCK,
    ],
  },
  {
    provide: BusinessBookingChanges,
    useFactory: (
      businesses: BusinessContextResolver,
      unitOfWork: UnitOfWork,
      store: BookingLifecycleStore,
      writer: BookingWriter,
      catalog: CatalogReader,
      assembler: AvailabilityAssembler,
      clients: ClientDirectory,
      queries: ClientBookingQueries,
      notifier: BookingNotifier,
      cancellation: BookingCancellation,
      prepayments: Prepayments,
      settlements: VisitSettlements,
      bookings: CabinetBookings,
      followUps: BookingFollowUps,
      telemetry: BookingTelemetry,
      ids: IdGenerator,
      clock: Clock,
    ) =>
      new BusinessBookingChanges(
        businesses,
        unitOfWork,
        store,
        writer,
        catalog,
        assembler,
        clients,
        queries,
        notifier,
        cancellation,
        prepayments,
        settlements,
        bookings,
        followUps,
        telemetry,
        ids,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      UNIT_OF_WORK,
      BOOKING_LIFECYCLE_STORE,
      BOOKING_WRITER,
      CATALOG_READER,
      AvailabilityAssembler,
      CLIENT_DIRECTORY,
      CLIENT_BOOKING_QUERIES,
      BookingNotifier,
      BookingCancellation,
      Prepayments,
      VisitSettlements,
      CabinetBookings,
      BOOKING_FOLLOW_UPS,
      BOOKING_TELEMETRY,
      ID_GENERATOR,
      CLOCK,
    ],
  },
];

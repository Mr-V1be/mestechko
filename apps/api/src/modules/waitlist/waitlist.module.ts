import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.js';
import { AvailabilityAssembler } from '../booking/application/availability/availability-assembler.js';
import { ClientBookingPresenter } from '../booking/application/client/client-booking-presenter.js';
import { BookingCancellation } from '../booking/application/lifecycle/booking-cancellation.js';
import { BookingHolds } from '../booking/application/lifecycle/booking-holds.js';
import {
  BOOKING_LIFECYCLE_STORE,
  type BookingLifecycleStore,
} from '../booking/application/lifecycle/ports.js';
import {
  BOOKING_FOLLOW_UPS,
  BOOKING_WRITER,
  CLIENT_BOOKING_QUERIES,
  type BookingFollowUps,
  type BookingWriter,
  type ClientBookingQueries,
} from '../booking/application/ports.js';
import { BookingModule } from '../booking/booking.module.js';
import { CATALOG_READER, type CatalogReader } from '../catalog/application/catalog-reader.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import {
  CLIENT_DIRECTORY,
  CUSTOMER_IDENTITIES,
  type ClientDirectory,
  type CustomerIdentities,
} from '../clients/application/ports.js';
import { ClientsModule } from '../clients/clients.module.js';
import {
  DISPATCH_KICK_KEY,
  dispatchNotificationsJob,
} from '../notifications/application/notification-jobs.js';
import {
  NOTIFICATION_OUTBOX,
  type NotificationOutbox,
} from '../notifications/application/ports.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Prepayments } from '../payments/application/prepayments.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { BusinessContextResolver } from '../tenancy/application/business-context.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { MiniAppWaitlistController } from './api/miniapp-waitlist.controller.js';
import { WAITLIST_STORE, type WaitlistStore } from './application/ports.js';
import { WaitlistEntries } from './application/waitlist-entries.js';
import { MatchWaitlist, waitlistHandlerTokens } from './application/waitlist-matching.js';
import { WaitlistOffers } from './application/waitlist-offers.js';
import { KyselyWaitlistStore } from './infrastructure/kysely-waitlist-store.js';

/** Clients waiting for a day, and offers to them one at a time when time frees up. */
@Module({
  imports: [
    TenancyModule,
    CatalogModule,
    ClientsModule,
    NotificationsModule,
    BookingModule,
    PaymentsModule,
  ],
  controllers: [MiniAppWaitlistController],
  providers: [
    {
      provide: WAITLIST_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyWaitlistStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    {
      provide: WaitlistOffers,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        customers: CustomerIdentities,
        clients: ClientDirectory,
        store: WaitlistStore,
        lifecycle: BookingLifecycleStore,
        queries: ClientBookingQueries,
        holds: BookingHolds,
        cancellation: BookingCancellation,
        prepayments: Prepayments,
        presenter: ClientBookingPresenter,
        followUps: BookingFollowUps,
        clock: Clock,
      ) =>
        new WaitlistOffers(
          businesses,
          unitOfWork,
          customers,
          clients,
          store,
          lifecycle,
          queries,
          holds,
          cancellation,
          prepayments,
          presenter,
          followUps,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CUSTOMER_IDENTITIES,
        CLIENT_DIRECTORY,
        WAITLIST_STORE,
        BOOKING_LIFECYCLE_STORE,
        CLIENT_BOOKING_QUERIES,
        BookingHolds,
        BookingCancellation,
        Prepayments,
        ClientBookingPresenter,
        BOOKING_FOLLOW_UPS,
        CLOCK,
      ],
    },
    {
      provide: WaitlistEntries,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        customers: CustomerIdentities,
        clients: ClientDirectory,
        catalog: CatalogReader,
        store: WaitlistStore,
        offers: WaitlistOffers,
        followUps: BookingFollowUps,
        ids: IdGenerator,
        clock: Clock,
      ) =>
        new WaitlistEntries(
          businesses,
          unitOfWork,
          customers,
          clients,
          catalog,
          store,
          offers,
          followUps,
          ids,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CUSTOMER_IDENTITIES,
        CLIENT_DIRECTORY,
        CATALOG_READER,
        WAITLIST_STORE,
        WaitlistOffers,
        BOOKING_FOLLOW_UPS,
        ID_GENERATOR,
        CLOCK,
      ],
    },
    {
      provide: waitlistHandlerTokens.match,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        store: WaitlistStore,
        assembler: AvailabilityAssembler,
        writer: BookingWriter,
        lifecycle: BookingLifecycleStore,
        outbox: NotificationOutbox,
        queue: JobQueue,
        ids: IdGenerator,
        clock: Clock,
      ) =>
        new MatchWaitlist(
          businesses,
          unitOfWork,
          store,
          assembler,
          writer,
          lifecycle,
          outbox,
          () =>
            queue.enqueue(dispatchNotificationsJob, {}, { deduplicationKey: DISPATCH_KICK_KEY }),
          ids,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        WAITLIST_STORE,
        AvailabilityAssembler,
        BOOKING_WRITER,
        BOOKING_LIFECYCLE_STORE,
        NOTIFICATION_OUTBOX,
        JOB_QUEUE,
        ID_GENERATOR,
        CLOCK,
      ],
    },
  ],
  exports: [WaitlistOffers],
})
export class WaitlistModule {}

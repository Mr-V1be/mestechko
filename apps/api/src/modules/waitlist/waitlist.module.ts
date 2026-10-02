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
import { CreateClientBooking } from '../booking/application/client/create-client-booking.js';
import { BOOKING_FOLLOW_UPS, type BookingFollowUps } from '../booking/application/ports.js';
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
  NOTIFICATION_STORE,
  type NotificationOutbox,
  type NotificationStore,
} from '../notifications/application/ports.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BusinessContextResolver } from '../tenancy/application/business-context.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { MiniAppWaitlistController } from './api/miniapp-waitlist.controller.js';
import { WAITLIST_STORE, type WaitlistStore } from './application/ports.js';
import { WaitlistEntries } from './application/waitlist-entries.js';
import { MatchWaitlist, waitlistHandlerTokens } from './application/waitlist-matching.js';
import { WaitlistOffers } from './application/waitlist-offers.js';
import { KyselyWaitlistStore } from './infrastructure/kysely-waitlist-store.js';

/** Clients waiting for a day, and offers when time frees up on it. */
@Module({
  imports: [TenancyModule, CatalogModule, ClientsModule, NotificationsModule, BookingModule],
  controllers: [MiniAppWaitlistController],
  providers: [
    {
      provide: WAITLIST_STORE,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyWaitlistStore(unitOfWork),
      inject: [KyselyUnitOfWork],
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
        ids: IdGenerator,
        clock: Clock,
      ) =>
        new WaitlistEntries(businesses, unitOfWork, customers, clients, catalog, store, ids, clock),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CUSTOMER_IDENTITIES,
        CLIENT_DIRECTORY,
        CATALOG_READER,
        WAITLIST_STORE,
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
        outbox: NotificationOutbox,
        queue: JobQueue,
        clock: Clock,
      ) =>
        new MatchWaitlist(
          businesses,
          unitOfWork,
          store,
          assembler,
          outbox,
          () =>
            queue.enqueue(dispatchNotificationsJob, {}, { deduplicationKey: DISPATCH_KICK_KEY }),
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        WAITLIST_STORE,
        AvailabilityAssembler,
        NOTIFICATION_OUTBOX,
        JOB_QUEUE,
        CLOCK,
      ],
    },
    {
      provide: WaitlistOffers,
      useFactory: (
        businesses: BusinessContextResolver,
        unitOfWork: UnitOfWork,
        customers: CustomerIdentities,
        store: WaitlistStore,
        notifications: NotificationStore,
        createBooking: CreateClientBooking,
        followUps: BookingFollowUps,
        clock: Clock,
      ) =>
        new WaitlistOffers(
          businesses,
          unitOfWork,
          customers,
          store,
          notifications,
          createBooking,
          followUps,
          clock,
        ),
      inject: [
        BusinessContextResolver,
        UNIT_OF_WORK,
        CUSTOMER_IDENTITIES,
        WAITLIST_STORE,
        NOTIFICATION_STORE,
        CreateClientBooking,
        BOOKING_FOLLOW_UPS,
        CLOCK,
      ],
    },
  ],
  exports: [WaitlistOffers],
})
export class WaitlistModule {}

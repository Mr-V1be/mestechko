import { Module } from '@nestjs/common';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import { JOB_QUEUE, type JobQueue } from '../../shared/application/job-queue.js';
import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../shared/application/ports.js';
import {
  DispatchNotifications,
  notificationHandlerTokens,
} from './application/notification-jobs.js';
import {
  NOTIFICATION_OUTBOX,
  NOTIFICATION_STORE,
  type NotificationStore,
} from './application/ports.js';
import { KyselyNotificationStore } from './infrastructure/kysely-notification-store.js';

/** The outbox of client messages and its dispatcher; delivery belongs to messaging. */
@Module({
  providers: [
    {
      provide: KyselyNotificationStore,
      useFactory: (unitOfWork: KyselyUnitOfWork, ids: IdGenerator) =>
        new KyselyNotificationStore(unitOfWork, ids),
      inject: [KyselyUnitOfWork, ID_GENERATOR],
    },
    { provide: NOTIFICATION_OUTBOX, useExisting: KyselyNotificationStore },
    { provide: NOTIFICATION_STORE, useExisting: KyselyNotificationStore },
    {
      provide: notificationHandlerTokens.dispatch,
      useFactory: (store: NotificationStore, queue: JobQueue, clock: Clock) =>
        new DispatchNotifications(store, queue, clock),
      inject: [NOTIFICATION_STORE, JOB_QUEUE, CLOCK],
    },
  ],
  exports: [NOTIFICATION_OUTBOX, NOTIFICATION_STORE],
})
export class NotificationsModule {}

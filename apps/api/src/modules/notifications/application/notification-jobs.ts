import { z } from 'zod';
import {
  defineJob,
  type JobHandler,
  type JobQueue,
} from '../../../shared/application/job-queue.js';
import type { Clock } from '../../../shared/application/ports.js';
import type { NotificationStore } from './ports.js';

const DISPATCH_HANDLER = Symbol('NOTIFICATIONS_DISPATCH_HANDLER');
/** Implemented by the messaging module, which knows how to talk to messengers. */
export const DELIVER_NOTIFICATION_HANDLER = Symbol('DELIVER_NOTIFICATION_HANDLER');

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
/** A claim outlives every retry of one delivery job; after it, the row is claimed again. */
const CLAIM_MS = 5 * MINUTE_MS;
const CLAIM_BATCH = 100;
/** Claims per message before it is given up: each claim runs a job with its own retries. */
export const MAX_DELIVERY_CLAIMS = 3;

export const dispatchNotificationsJob = defineJob({
  name: 'notifications-dispatch',
  payload: z.object({}),
  attempts: 3,
  backoffMs: 10 * SECOND_MS,
  concurrency: 1,
  handler: DISPATCH_HANDLER,
  every: '* * * * *',
});

export const deliverNotificationJob = defineJob({
  name: 'notification-deliver',
  payload: z.object({ notificationId: z.uuid() }),
  attempts: 3,
  backoffMs: 15 * SECOND_MS,
  concurrency: 5,
  handler: DELIVER_NOTIFICATION_HANDLER,
});

export const notificationHandlerTokens = { dispatch: DISPATCH_HANDLER };

/** Kicks share one pending dispatch: a burst of changes triggers it once. */
export const DISPATCH_KICK_KEY = 'notifications-dispatch-kick';

/**
 * Moves due messages from the outbox to delivery jobs. Runs every minute and right
 * after changes that make messages due now.
 */
export class DispatchNotifications implements JobHandler<Record<string, never>> {
  constructor(
    private readonly store: NotificationStore,
    private readonly queue: JobQueue,
    private readonly clock: Clock,
  ) {}

  async handle(): Promise<void> {
    for (;;) {
      const now = new Date(this.clock.now().epochMilliseconds);
      const claimed = await this.store.claimDue(
        now,
        new Date(now.getTime() + CLAIM_MS),
        CLAIM_BATCH,
      );
      for (const notification of claimed) {
        if (notification.attempts > MAX_DELIVERY_CLAIMS) {
          await this.store.markFailed(notification.id, 'attempts_exhausted', now);
          continue;
        }
        await this.queue.enqueue(
          deliverNotificationJob,
          { notificationId: notification.id },
          { deduplicationKey: `notification-${notification.id}-${String(notification.attempts)}` },
        );
      }
      if (claimed.length < CLAIM_BATCH) {
        return;
      }
    }
  }
}

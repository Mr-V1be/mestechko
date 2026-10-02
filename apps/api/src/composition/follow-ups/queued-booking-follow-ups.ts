import type { PinoLogger } from 'nestjs-pino';
import type { JobQueue } from '../../shared/application/job-queue.js';
import type {
  BookingFollowUps,
  CommittedBookingChange,
} from '../../modules/booking/application/ports.js';
import {
  DISPATCH_KICK_KEY,
  dispatchNotificationsJob,
} from '../../modules/notifications/application/notification-jobs.js';
import {
  refundDeduplicationKey,
  refundPaymentJob,
} from '../../modules/payments/application/refund-jobs.js';
import {
  matchDeduplicationKey,
  matchWaitlistJob,
} from '../../modules/waitlist/application/waitlist-matching.js';

/**
 * Wires booking changes to the modules that react to them, through the job queue:
 * messages due now are dispatched, freed time is offered to the waitlist, promised
 * refunds are asked for. A failed enqueue loses nothing: sweeps run periodically.
 */
export class QueuedBookingFollowUps implements BookingFollowUps {
  constructor(
    private readonly queue: JobQueue,
    private readonly logger: PinoLogger,
  ) {}

  async afterCommit(change: CommittedBookingChange): Promise<void> {
    try {
      await this.queue.enqueue(
        dispatchNotificationsJob,
        {},
        { deduplicationKey: DISPATCH_KICK_KEY },
      );
      if (change.freedTime) {
        const payload = { businessId: change.businessId, ...change.freedTime };
        await this.queue.enqueue(matchWaitlistJob, payload, {
          deduplicationKey: matchDeduplicationKey(payload),
        });
      }
      for (const paymentId of change.refunds ?? []) {
        await this.queue.enqueue(
          refundPaymentJob,
          { businessId: change.businessId, paymentId },
          { deduplicationKey: refundDeduplicationKey(paymentId) },
        );
      }
    } catch (error) {
      this.logger.warn({ err: error, businessId: change.businessId }, 'Follow-up enqueue failed');
    }
  }
}

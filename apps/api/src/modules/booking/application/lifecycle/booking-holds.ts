import { holdReasons, type Clock } from '@slotwise/domain';
import { z } from 'zod';
import { defineJob, type JobHandler } from '../../../../shared/application/job-queue.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { BusinessContext } from '../../../tenancy/application/business-context.js';
import type { BookingFollowUps, ExpiredHolds } from '../ports.js';
import type { BookingCancellation, CancellationOutcome } from './booking-cancellation.js';
import type { BookingNotifier } from './booking-notifier.js';
import type { BookingLifecycleStore, LockedBooking } from './ports.js';

const SWEEP_HANDLER = Symbol('BOOKING_HOLDS_SWEEP_HANDLER');
const SECOND_MS = 1_000;
const SWEEP_BATCH = 200;

export const releaseExpiredHoldsJob = defineJob({
  name: 'booking-holds-release',
  payload: z.object({}),
  attempts: 1,
  backoffMs: SECOND_MS,
  concurrency: 1,
  handler: SWEEP_HANDLER,
  every: '* * * * *',
});

export const bookingHoldHandlerTokens = { sweep: SWEEP_HANDLER };

/** Why a hold ends without a booking: its time ran out, or the client declined to pay. */
export type HoldRelease = 'expired' | 'declined';

/**
 * The end of a hold: confirmed when the prepayment arrives or the offer is accepted,
 * released when its time runs out or the client turns the payment down.
 */
export class BookingHolds {
  constructor(
    private readonly store: BookingLifecycleStore,
    private readonly cancellation: BookingCancellation,
    private readonly notifier: BookingNotifier,
    private readonly ids: IdGenerator,
  ) {}

  /**
   * Lets the held time go. Nothing was promised to the client, so nothing is refunded
   * or announced; a declined payment is the client's own step, an expiry the system's.
   */
  async release(
    businessId: string,
    booking: LockedBooking,
    why: HoldRelease,
    now: Date,
  ): Promise<CancellationOutcome['freedTime']> {
    const outcome = await this.cancellation.cancel(booking, {
      businessId,
      actor: why === 'declined' ? 'client' : 'system',
      channel: null,
      actorUserId: null,
      refundsDeposit: false,
      seenByClient: why === 'declined',
      now,
    });
    return outcome.freedTime;
  }

  /** Makes a held booking firm; the client then gets the usual notice and reminders. */
  async confirm(
    context: BusinessContext,
    booking: LockedBooking,
    origin: { readonly seenByClient: boolean },
    now: Date,
  ): Promise<void> {
    await this.store.setStatus(booking, 'confirmed', now);
    await this.store.recordEvent({
      id: this.ids.next(),
      bookingId: booking.id,
      kind: 'confirmed',
      actor: 'system',
      channel: null,
      previousStartsAt: null,
      previousStaffId: null,
      actorUserId: null,
      occurredAt: now,
    });
    await this.notifier.plan({
      businessId: context.business.id,
      booking: {
        id: booking.id,
        version: booking.version + 1,
        startsAt: booking.startsAt,
        source: booking.source,
        customerId: booking.customerId,
      },
      event: 'confirmed',
      seenByClient: origin.seenByClient,
      now,
    });
  }

  /** Whether the booking waits for its prepayment right now. */
  awaitsPayment(booking: LockedBooking): boolean {
    return booking.hold !== null && holdReasons[booking.hold.reason].awaitsPayment;
  }
}

/** Releases holds that ran out, every minute; the freed time goes to the waitlist. */
export class ReleaseExpiredHolds implements JobHandler<Record<string, never>> {
  constructor(
    private readonly expired: ExpiredHolds,
    private readonly unitOfWork: UnitOfWork,
    private readonly store: BookingLifecycleStore,
    private readonly holds: BookingHolds,
    private readonly followUps: BookingFollowUps,
    private readonly clock: Clock,
  ) {}

  async handle(): Promise<void> {
    const now = new Date(this.clock.now().epochMilliseconds);
    for (const hold of await this.expired.list(now, SWEEP_BATCH)) {
      await this.release(hold.businessId, hold.bookingId, now);
    }
  }

  async release(businessId: string, bookingId: string, now: Date): Promise<void> {
    const freedTime = await this.unitOfWork.inTenant(businessId, async () => {
      const booking = await this.store.lock(bookingId);
      if (!booking?.hold || booking.hold.expiresAt.getTime() > now.getTime()) {
        return null;
      }
      return this.holds.release(businessId, booking, 'expired', now);
    });
    if (freedTime) {
      await this.followUps.afterCommit({ businessId, freedTime });
    }
  }
}

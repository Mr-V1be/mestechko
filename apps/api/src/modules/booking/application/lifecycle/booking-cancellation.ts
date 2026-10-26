import {
  bookingStatuses,
  canMoveToStatus,
  localDateOf,
  type BookingActor,
  type MessengerChannel,
} from '@slotwise/domain';
import { ApplicationError } from '../../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type { CommittedBookingChange } from '../ports.js';
import type { BookingNotifier } from './booking-notifier.js';
import type { BookingLifecycleStore, LockedBooking } from './ports.js';

export interface CancellationRequest {
  readonly businessId: string;
  readonly actor: BookingActor;
  readonly channel: MessengerChannel | null;
  readonly actorUserId: string | null;
  /** Whether a prepayment goes back, by the business's rules for this actor. */
  readonly refundsDeposit: boolean;
  /** The client sees the outcome where they acted; no separate notice follows. */
  readonly seenByClient: boolean;
  readonly now: Date;
}

export interface CancellationOutcome {
  readonly freedTime: CommittedBookingChange['freedTime'];
  /** Payment to refund once the transaction commits. */
  readonly refundPaymentId: string | null;
}

/**
 * Cancels a booking the same way whoever does it: the time is freed, an unpaid
 * prepayment is called off or a paid one promised back, and the client is told.
 * A held booking was never confirmed to the client, so releasing it sends nothing.
 */
export class BookingCancellation {
  constructor(
    private readonly store: BookingLifecycleStore,
    private readonly prepayments: Prepayments,
    private readonly notifier: BookingNotifier,
    private readonly ids: IdGenerator,
  ) {}

  async cancel(booking: LockedBooking, request: CancellationRequest): Promise<CancellationOutcome> {
    if (!canMoveToStatus(booking.status, 'cancelled')) {
      throw new ApplicationError('change_not_allowed', 'The booking can no longer be cancelled', {
        reason: 'closed',
      });
    }
    await this.store.setStatus(booking, 'cancelled', request.now);
    await this.store.recordEvent({
      id: this.ids.next(),
      bookingId: booking.id,
      kind: 'cancelled',
      actor: request.actor,
      channel: request.channel,
      previousStartsAt: null,
      previousStaffId: null,
      actorUserId: request.actorUserId,
      occurredAt: request.now,
    });
    const wasConfirmed = !bookingStatuses[booking.status].clientMayRelease;
    let refundPaymentId: string | null = null;
    if (wasConfirmed && request.refundsDeposit) {
      refundPaymentId = await this.prepayments.requestRefund(
        booking.id,
        await this.prepayments.keptFor(booking.id),
        request.now,
      );
    } else {
      await this.prepayments.cancelPending(booking.id, request.now);
    }
    if (wasConfirmed) {
      await this.notifier.plan({
        businessId: request.businessId,
        booking: {
          id: booking.id,
          version: booking.version + 1,
          startsAt: booking.startsAt,
          source: booking.source,
          customerId: booking.customerId,
        },
        event: 'cancelled',
        seenByClient: request.seenByClient,
        now: request.now,
      });
    }
    return {
      freedTime: {
        locationId: booking.locationId,
        date: localDateOf(booking.startsAt.getTime(), booking.timeZone).toString(),
      },
      refundPaymentId,
    };
  }
}

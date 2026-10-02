import { canMovePaymentTo, paymentStatuses, type Money } from '@mestechko/domain';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { LedgerBook } from '../../loyalty/application/ledger-book.js';
import type { PaymentRecord, PaymentStore, ProviderEvent } from './ports.js';

/** What a provider notification changed. */
export type PaymentOutcome =
  | { readonly kind: 'succeeded'; readonly payment: PaymentRecord }
  | { readonly kind: 'cancelled' | 'refunded' | 'unchanged'; readonly payment: PaymentRecord }
  | { readonly kind: 'unknown' };

/**
 * Prepayments of bookings inside the caller's tenant transaction: opening one, the
 * provider's verdicts, and refunds. Money moves reach the ledger in the same
 * transaction as the payment's state.
 */
export class Prepayments {
  constructor(
    private readonly store: PaymentStore,
    private readonly book: LedgerBook,
    private readonly providerId: string,
    private readonly ids: IdGenerator,
  ) {}

  async open(input: {
    readonly bookingId: string;
    readonly clientId: string;
    readonly amount: Money;
    readonly now: Date;
  }): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: this.ids.next(),
      bookingId: input.bookingId,
      clientId: input.clientId,
      provider: this.providerId,
      providerPaymentId: null,
      checkoutUrl: null,
      amountMinor: input.amount.amountMinor,
      currency: input.amount.currency,
      status: 'pending',
      refundRequestedMinor: 0,
      refundedMinor: 0,
    };
    await this.store.insert(payment, input.now);
    return payment;
  }

  ofBooking(bookingId: string): Promise<PaymentRecord | null> {
    return this.store.latestForBooking(bookingId);
  }

  ofBookings(bookingIds: readonly string[]): Promise<Map<string, PaymentRecord>> {
    return this.store.latestForBookings(bookingIds);
  }

  /** Prepayment the business keeps for the booking: paid and not promised back. */
  async keptFor(bookingId: string): Promise<number> {
    const payment = await this.store.latestForBooking(bookingId);
    return payment && paymentStatuses[payment.status].holdsMoney
      ? payment.amountMinor - payment.refundRequestedMinor
      : 0;
  }

  /** The booking no longer waits for its payment: an unpaid one is called off. */
  async cancelPending(bookingId: string, now: Date): Promise<void> {
    const latest = await this.store.latestForBooking(bookingId);
    const payment = latest ? await this.store.lock(latest.id) : null;
    if (payment?.status === 'pending') {
      await this.store.update(payment.id, { status: 'cancelled' }, now);
    }
  }

  /**
   * Promises money back to the client; the refund itself is asked from the provider
   * after the transaction commits. Returns the payment to refund, if any.
   */
  async requestRefund(bookingId: string, amountMinor: number, now: Date): Promise<string | null> {
    const latest = await this.store.latestForBooking(bookingId);
    const payment = latest ? await this.store.lock(latest.id) : null;
    if (
      !payment ||
      !paymentStatuses[payment.status].holdsMoney ||
      payment.refundRequestedMinor > 0 ||
      amountMinor <= 0
    ) {
      return null;
    }
    await this.store.update(
      payment.id,
      { refundRequestedMinor: Math.min(amountMinor, payment.amountMinor) },
      now,
    );
    return payment.id;
  }

  /** Applies a verified notification once; repeated deliveries change nothing. */
  async apply(event: ProviderEvent, now: Date): Promise<PaymentOutcome> {
    const payment = await this.store.lock(event.metadata.paymentId);
    if (
      payment?.provider !== this.providerId ||
      (payment.providerPaymentId !== null && payment.providerPaymentId !== event.providerPaymentId)
    ) {
      return { kind: 'unknown' };
    }
    const fresh = await this.store.recordEvent(
      { provider: this.providerId, eventId: event.eventId, kind: event.kind },
      payment.id,
      now,
    );
    if (!fresh) {
      return { kind: 'unchanged', payment };
    }
    switch (event.kind) {
      case 'payment_succeeded':
        return this.succeeded(payment, now);
      case 'payment_cancelled':
        if (!canMovePaymentTo(payment.status, 'cancelled')) {
          return { kind: 'unchanged', payment };
        }
        await this.store.update(payment.id, { status: 'cancelled' }, now);
        return { kind: 'cancelled', payment: { ...payment, status: 'cancelled' } };
      case 'refund_succeeded':
        return this.confirmRefund(payment, event.refundedMinor, now);
    }
  }

  /** Records a refund the provider confirmed, up to the total refunded so far. */
  async confirmRefund(
    payment: PaymentRecord,
    refundedTotal: number,
    now: Date,
  ): Promise<PaymentOutcome> {
    const delta = Math.min(refundedTotal, payment.amountMinor) - payment.refundedMinor;
    if (delta <= 0) {
      return { kind: 'unchanged', payment };
    }
    const refundedMinor = payment.refundedMinor + delta;
    const status = refundedMinor === payment.amountMinor ? 'refunded' : payment.status;
    await this.store.update(
      payment.id,
      {
        status,
        refundedMinor,
        refundRequestedMinor: Math.max(payment.refundRequestedMinor, refundedMinor),
      },
      now,
    );
    await this.book.post(
      { clientId: payment.clientId, currency: payment.currency, actorUserId: null, now },
      [
        {
          reason: 'prepayment_refund',
          amount: -delta,
          bookingId: payment.bookingId,
          paymentId: payment.id,
        },
      ],
    );
    return { kind: 'refunded', payment: { ...payment, status, refundedMinor } };
  }

  /**
   * Money arrived. It is recorded even if the booking stopped waiting meanwhile (the
   * client paid after the hold expired); the booking side then gives it back.
   */
  private async succeeded(payment: PaymentRecord, now: Date): Promise<PaymentOutcome> {
    if (!canMovePaymentTo(payment.status, 'succeeded')) {
      return { kind: 'unchanged', payment };
    }
    await this.store.update(payment.id, { status: 'succeeded', paidAt: now }, now);
    await this.book.post(
      { clientId: payment.clientId, currency: payment.currency, actorUserId: null, now },
      [
        {
          reason: 'prepayment',
          amount: payment.amountMinor,
          bookingId: payment.bookingId,
          paymentId: payment.id,
        },
      ],
    );
    return { kind: 'succeeded', payment: { ...payment, status: 'succeeded' } };
  }
}

import type { CheckoutPresentation, CurrencyCode, Money, PaymentStatus } from '@mestechko/domain';

/** What the payment page needs to take a prepayment. */
export interface CheckoutRequest {
  /** Repeating a request with the same key returns the same payment. */
  readonly idempotencyKey: string;
  readonly amount: Money;
  readonly description: string;
  /** Where the payer returns after paying or giving up: a path of the app, or the neutral page. */
  readonly returnUrl: string;
  /** Echoed back in notifications; tells us whose payment it is. */
  readonly metadata: PaymentMetadata;
  /** The payment page stops accepting payment after this. */
  readonly expiresAt: Date;
}

export interface PaymentMetadata {
  readonly businessId: string;
  readonly paymentId: string;
}

export interface ProviderCheckout {
  readonly providerPaymentId: string;
  readonly checkoutUrl: string;
}

export interface RefundRequest {
  readonly idempotencyKey: string;
  readonly providerPaymentId: string;
  readonly amount: Money;
}

/** A notification from the provider, verified to come from it. */
export interface ProviderEvent {
  readonly eventId: string;
  readonly kind: 'payment_succeeded' | 'payment_cancelled' | 'refund_succeeded';
  readonly providerPaymentId: string;
  /** For refunds: everything refunded so far. */
  readonly refundedMinor: number;
  readonly metadata: PaymentMetadata;
}

/** A webhook as it arrived: the provider signs the exact bytes. */
export interface WebhookDelivery {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly rawBody: Buffer;
}

export class InvalidWebhookError extends Error {
  constructor(reason: string) {
    super(`Rejected payment notification: ${reason}`);
    this.name = 'InvalidWebhookError';
  }
}

/** A payment provider behind its own adapter; the domain never sees which one. */
export interface PaymentProvider {
  readonly id: string;
  /** Where the provider's payment page opens: in place of the app or in the browser. */
  readonly presentation: CheckoutPresentation;
  createCheckout(request: CheckoutRequest): Promise<ProviderCheckout>;
  /** `pending` refunds are confirmed later by a notification. */
  refund(request: RefundRequest): Promise<{ readonly status: 'succeeded' | 'pending' }>;
  /** Verifies a notification and reads it; throws `InvalidWebhookError` when it is not genuine. */
  parseWebhook(delivery: WebhookDelivery): ProviderEvent;
}

export interface PaymentRecord {
  readonly id: string;
  readonly bookingId: string;
  readonly clientId: string;
  readonly provider: string;
  readonly providerPaymentId: string | null;
  readonly checkoutUrl: string | null;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly status: PaymentStatus;
  readonly refundRequestedMinor: number;
  readonly refundedMinor: number;
}

/** Prepayments of the current tenant. */
export interface PaymentStore {
  insert(payment: PaymentRecord, now: Date): Promise<void>;
  find(paymentId: string): Promise<PaymentRecord | null>;
  /** The payment with a row lock until the transaction ends. */
  lock(paymentId: string): Promise<PaymentRecord | null>;
  /** The booking's latest payment, whatever its state. */
  latestForBooking(bookingId: string): Promise<PaymentRecord | null>;
  latestForBookings(bookingIds: readonly string[]): Promise<Map<string, PaymentRecord>>;
  attachCheckout(paymentId: string, checkout: ProviderCheckout, now: Date): Promise<void>;
  update(
    paymentId: string,
    changes: Partial<Pick<PaymentRecord, 'status' | 'refundRequestedMinor' | 'refundedMinor'>> & {
      readonly paidAt?: Date;
    },
    now: Date,
  ): Promise<void>;
  /** Records a processed notification; `false` when it was processed before. */
  recordEvent(
    event: { readonly provider: string; readonly eventId: string; readonly kind: string },
    paymentId: string,
    now: Date,
  ): Promise<boolean>;
}

/** Refunds the provider has not confirmed, across businesses. */
export interface PendingRefunds {
  list(limit: number): Promise<{ readonly businessId: string; readonly paymentId: string }[]>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export const PAYMENT_STORE = Symbol('PAYMENT_STORE');
export const PENDING_REFUNDS = Symbol('PENDING_REFUNDS');

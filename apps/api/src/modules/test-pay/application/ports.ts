import type { Locale } from '@mestechko/domain';

/** A payment as the test provider keeps it. */
export interface TestPayPayment {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  readonly returnUrl: string;
  /** The language of the payment page: the payer's. */
  readonly locale: Locale;
  readonly metadata: Readonly<Record<string, string>>;
  readonly status: 'pending' | 'succeeded' | 'cancelled';
  readonly refundedMinor: number;
  readonly expiresAt: Date;
}

export type TestPayEventType = 'payment.succeeded' | 'payment.cancelled' | 'refund.succeeded';

export interface TestPayEvent {
  readonly id: string;
  readonly paymentId: string;
  readonly type: TestPayEventType;
  readonly body: string;
  readonly attempts: number;
}

/** The provider's own records. Platform-wide: they belong to no tenant. */
export interface TestPayStore {
  /** Inserts unless the key was used; returns the payment stored under the key. */
  createOnce(payment: TestPayPayment, now: Date): Promise<TestPayPayment>;
  find(paymentId: string): Promise<TestPayPayment | null>;
  /** The payment with a row lock until the transaction ends. */
  lock(paymentId: string): Promise<TestPayPayment | null>;
  setStatus(paymentId: string, status: TestPayPayment['status'], now: Date): Promise<void>;
  /** Records a refund once per key; returns `false` when the key was used. */
  addRefund(
    refund: { readonly id: string; readonly paymentId: string; readonly idempotencyKey: string },
    amountMinor: number,
    now: Date,
  ): Promise<boolean>;
  addEvent(event: Omit<TestPayEvent, 'attempts'>, now: Date): Promise<void>;
  /** The event unless it was delivered already. */
  findUndelivered(eventId: string): Promise<TestPayEvent | null>;
  markDelivered(eventId: string, now: Date): Promise<void>;
  countAttempt(eventId: string): Promise<void>;
  undeliveredEvents(limit: number): Promise<string[]>;
  /** Pending payments past their deadline. */
  expiredPayments(now: Date, limit: number): Promise<string[]>;
  /** Runs work in one platform transaction. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export const TEST_PAY_STORE = Symbol('TEST_PAY_STORE');

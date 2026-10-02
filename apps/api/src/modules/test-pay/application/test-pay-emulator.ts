import { z } from 'zod';
import {
  defineJob,
  type JobHandler,
  type JobQueue,
} from '../../../shared/application/job-queue.js';
import type { Clock, IdGenerator } from '../../../shared/application/ports.js';
import type { TestPayEventType, TestPayPayment, TestPayStore } from './ports.js';

const DELIVER_HANDLER = Symbol('TEST_PAY_DELIVER_HANDLER');
const SWEEP_HANDLER = Symbol('TEST_PAY_SWEEP_HANDLER');
const SECOND_MS = 1_000;
const SWEEP_BATCH = 100;

export const deliverTestPayEventJob = defineJob({
  name: 'test-pay-webhook',
  payload: z.object({ eventId: z.string().min(1) }),
  attempts: 6,
  backoffMs: 10 * SECOND_MS,
  concurrency: 2,
  handler: DELIVER_HANDLER,
});

export const sweepTestPayJob = defineJob({
  name: 'test-pay-sweep',
  payload: z.object({}),
  attempts: 1,
  backoffMs: SECOND_MS,
  concurrency: 1,
  handler: SWEEP_HANDLER,
  every: '* * * * *',
});

export const testPayHandlerTokens = { deliver: DELIVER_HANDLER, sweep: SWEEP_HANDLER };

/** The provider's request refused, with an HTTP status as its API would answer. */
export class TestPayRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TestPayRefusal';
  }
}

export interface NewTestPayment {
  readonly idempotencyKey: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  readonly returnUrl: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

/** Sends a signed notification; `true` when the receiver accepted it. */
export interface WebhookSender {
  send(body: string): Promise<boolean>;
}

/**
 * The test payment provider as the demo runs it: payments with a hosted page, refunds,
 * and notifications delivered with retries until the receiver accepts them.
 */
export class TestPayEmulator {
  constructor(
    private readonly store: TestPayStore,
    private readonly queue: JobQueue,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly checkoutBaseUrl: string,
  ) {}

  async create(input: NewTestPayment): Promise<TestPayPayment> {
    if (input.expiresAt.getTime() <= this.now().getTime()) {
      throw new TestPayRefusal(400, 'The payment would already be expired');
    }
    return this.store.createOnce(
      {
        id: `tp_${this.ids.next().replaceAll('-', '')}`,
        ...input,
        status: 'pending',
        refundedMinor: 0,
      },
      this.now(),
    );
  }

  find(paymentId: string): Promise<TestPayPayment | null> {
    return this.store.find(paymentId);
  }

  checkoutUrlOf(payment: TestPayPayment): string {
    return `${this.checkoutBaseUrl}/checkout/${payment.id}`;
  }

  isOpen(payment: TestPayPayment): boolean {
    return payment.status === 'pending' && payment.expiresAt.getTime() > this.now().getTime();
  }

  /** The payer's choice on the payment page; returns where to send them back. */
  async decide(paymentId: string, decision: 'pay' | 'cancel'): Promise<string> {
    const outcome = await this.store.transaction(async () => {
      const payment = await this.store.lock(paymentId);
      if (!payment) {
        throw new TestPayRefusal(404, 'Payment not found');
      }
      if (!this.isOpen(payment)) {
        return { payment, eventId: null };
      }
      const status = decision === 'pay' ? 'succeeded' : 'cancelled';
      await this.store.setStatus(payment.id, status, this.now());
      const eventId = await this.emit(
        { ...payment, status },
        decision === 'pay' ? 'payment.succeeded' : 'payment.cancelled',
      );
      return { payment, eventId };
    });
    if (outcome.eventId) {
      await this.deliverSoon(outcome.eventId);
    }
    return outcome.payment.returnUrl;
  }

  /** Refunds up to the paid amount, once per idempotency key. */
  async refund(paymentId: string, idempotencyKey: string, amountMinor: number) {
    const outcome = await this.store.transaction(async () => {
      const payment = await this.store.lock(paymentId);
      if (!payment) {
        throw new TestPayRefusal(404, 'Payment not found');
      }
      if (payment.status !== 'succeeded') {
        throw new TestPayRefusal(409, 'Only a paid payment can be refunded');
      }
      const refundId = `tr_${this.ids.next().replaceAll('-', '')}`;
      const fresh = await this.store.addRefund(
        { id: refundId, paymentId, idempotencyKey },
        Math.min(amountMinor, payment.amountMinor - payment.refundedMinor),
        this.now(),
      );
      const refunded = (await this.store.find(paymentId)) ?? payment;
      const eventId = fresh ? await this.emit(refunded, 'refund.succeeded') : null;
      return { refundId, payment: refunded, eventId };
    });
    if (outcome.eventId) {
      await this.deliverSoon(outcome.eventId);
    }
    return { id: outcome.refundId, status: 'succeeded' as const, payment: outcome.payment };
  }

  /** Cancels payments nobody paid in time and retries notifications not yet accepted. */
  async sweep(): Promise<void> {
    for (const paymentId of await this.store.expiredPayments(this.now(), SWEEP_BATCH)) {
      const eventId = await this.store.transaction(async () => {
        const payment = await this.store.lock(paymentId);
        if (payment?.status !== 'pending') {
          return null;
        }
        await this.store.setStatus(paymentId, 'cancelled', this.now());
        return this.emit({ ...payment, status: 'cancelled' }, 'payment.cancelled');
      });
      if (eventId) {
        await this.deliverSoon(eventId);
      }
    }
    for (const eventId of await this.store.undeliveredEvents(SWEEP_BATCH)) {
      await this.deliverSoon(eventId);
    }
  }

  /** The payment as the provider's API and notifications describe it. */
  view(payment: TestPayPayment) {
    return {
      id: payment.id,
      status: payment.status,
      confirmation_url: this.checkoutUrlOf(payment),
      amount: { value_minor: payment.amountMinor, currency: payment.currency },
      refunded_minor: payment.refundedMinor,
      description: payment.description,
      metadata: payment.metadata,
      expires_at: payment.expiresAt.toISOString(),
    };
  }

  private async emit(payment: TestPayPayment, type: TestPayEventType): Promise<string> {
    const id = `te_${this.ids.next().replaceAll('-', '')}`;
    const body = JSON.stringify({
      id,
      type,
      created_at: this.now().toISOString(),
      data: { payment: this.view(payment) },
    });
    await this.store.addEvent({ id, paymentId: payment.id, type, body }, this.now());
    return id;
  }

  private async deliverSoon(eventId: string): Promise<void> {
    await this.queue.enqueue(
      deliverTestPayEventJob,
      { eventId },
      { deduplicationKey: `test-pay-event-${eventId}` },
    );
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}

/** Delivers one notification; a refusal throws, so the queue retries it. */
export class DeliverTestPayEvent implements JobHandler<
  z.infer<typeof deliverTestPayEventJob.payload>
> {
  constructor(
    private readonly store: TestPayStore,
    private readonly sender: WebhookSender,
    private readonly clock: Clock,
  ) {}

  async handle(payload: z.infer<typeof deliverTestPayEventJob.payload>): Promise<void> {
    const event = await this.store.findUndelivered(payload.eventId);
    if (!event) {
      return;
    }
    await this.store.countAttempt(event.id);
    if (!(await this.sender.send(event.body))) {
      throw new Error(`Notification ${event.id} was not accepted`);
    }
    await this.store.markDelivered(event.id, new Date(this.clock.now().epochMilliseconds));
  }
}

export class SweepTestPay implements JobHandler<Record<string, never>> {
  constructor(private readonly emulator: TestPayEmulator) {}

  handle(): Promise<void> {
    return this.emulator.sweep();
  }
}

import { z } from 'zod';
import {
  defineJob,
  type JobHandler,
  type JobQueue,
} from '../../../shared/application/job-queue.js';
import type { Clock } from '../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { PaymentProvider, PaymentStore, PendingRefunds } from './ports.js';
import type { Prepayments } from './prepayments.js';

const REFUND_HANDLER = Symbol('PAYMENT_REFUND_HANDLER');
const SWEEP_HANDLER = Symbol('PAYMENT_REFUND_SWEEP_HANDLER');
const SECOND_MS = 1_000;
const SWEEP_BATCH = 100;

export const refundPaymentJob = defineJob({
  name: 'payment-refund',
  payload: z.object({ businessId: z.uuid(), paymentId: z.uuid() }),
  attempts: 5,
  backoffMs: 30 * SECOND_MS,
  concurrency: 2,
  handler: REFUND_HANDLER,
});

export const sweepRefundsJob = defineJob({
  name: 'payment-refund-sweep',
  payload: z.object({}),
  attempts: 1,
  backoffMs: SECOND_MS,
  concurrency: 1,
  handler: SWEEP_HANDLER,
  every: '*/5 * * * *',
});

export const refundHandlerTokens = { refund: REFUND_HANDLER, sweep: SWEEP_HANDLER };

/** One refund job per payment at a time. */
export function refundDeduplicationKey(paymentId: string): string {
  return `payment-refund-${paymentId}`;
}

/**
 * Asks the provider for the refund the business promised. The key makes the provider
 * refund once however often this runs; the ledger entry follows its confirmation.
 */
export class RefundPayment implements JobHandler<z.infer<typeof refundPaymentJob.payload>> {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: PaymentStore,
    private readonly prepayments: Prepayments,
    private readonly provider: PaymentProvider,
    private readonly clock: Clock,
  ) {}

  async handle(payload: z.infer<typeof refundPaymentJob.payload>): Promise<void> {
    const payment = await this.unitOfWork.inTenant(
      payload.businessId,
      () => this.store.find(payload.paymentId),
      { readOnly: true },
    );
    if (!payment?.providerPaymentId || payment.refundRequestedMinor <= payment.refundedMinor) {
      return;
    }
    const result = await this.provider.refund({
      idempotencyKey: `${payment.id}-refund`,
      providerPaymentId: payment.providerPaymentId,
      amount: { amountMinor: payment.refundRequestedMinor, currency: payment.currency },
    });
    if (result.status !== 'succeeded') {
      return;
    }
    await this.unitOfWork.inTenant(payload.businessId, async () => {
      const locked = await this.store.lock(payment.id);
      if (locked) {
        await this.prepayments.confirmRefund(
          locked,
          locked.refundRequestedMinor,
          new Date(this.clock.now().epochMilliseconds),
        );
      }
    });
  }
}

/** Retries refunds the provider has not confirmed, e.g. after it was unreachable. */
export class SweepRefunds implements JobHandler<Record<string, never>> {
  constructor(
    private readonly pending: PendingRefunds,
    private readonly queue: JobQueue,
  ) {}

  async handle(): Promise<void> {
    for (const refund of await this.pending.list(SWEEP_BATCH)) {
      await this.queue.enqueue(refundPaymentJob, refund, {
        deduplicationKey: refundDeduplicationKey(refund.paymentId),
      });
    }
  }
}

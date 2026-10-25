import { timingSafeEqual } from 'node:crypto';
import type { CheckoutPresentation } from '@mestechko/domain';
import { z } from 'zod';
import {
  InvalidWebhookError,
  type CheckoutRequest,
  type PaymentProvider,
  type ProviderCheckout,
  type ProviderEvent,
  type RefundRequest,
  type WebhookDelivery,
} from '../application/ports.js';
import { signTestPayBody, TEST_PAY_SIGNATURE_HEADER } from './test-pay-protocol.js';
/** Notifications older than this are refused, so a captured one cannot be replayed later. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const MS_PER_SECOND = 1_000;

const amountSchema = z.object({ value_minor: z.number().int(), currency: z.string() });

const paymentSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'succeeded', 'cancelled']),
  confirmation_url: z.string().min(1),
  amount: amountSchema,
  refunded_minor: z.number().int().min(0),
  metadata: z.object({ businessId: z.uuid(), paymentId: z.uuid() }),
});

const refundSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['succeeded', 'pending']),
});

const eventSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(['payment.succeeded', 'payment.cancelled', 'refund.succeeded']),
  data: z.object({ payment: paymentSchema }),
});

const eventKinds: Record<z.infer<typeof eventSchema>['type'], ProviderEvent['kind']> = {
  'payment.succeeded': 'payment_succeeded',
  'payment.cancelled': 'payment_cancelled',
  'refund.succeeded': 'refund_succeeded',
};

export class TestPayRequestError extends Error {
  constructor(status: number) {
    super(`Test payment provider answered ${String(status)}`);
    this.name = 'TestPayRequestError';
  }
}

/**
 * Adapter of the test payment provider: a hosted payment page, refunds, and
 * notifications signed with HMAC-SHA256 over the timestamp and the exact body.
 */
export class TestPayProvider implements PaymentProvider {
  readonly id = 'test';
  readonly presentation: CheckoutPresentation;

  constructor(
    private readonly options: {
      readonly apiUrl: string;
      readonly secretKey: string;
      readonly webhookSecret: string;
      readonly timeoutMs: number;
      readonly now: () => number;
      /** The emulator's page can be framed; it can also stand in for a provider that cannot. */
      readonly presentation: CheckoutPresentation;
    },
  ) {
    this.presentation = options.presentation;
  }

  async createCheckout(request: CheckoutRequest): Promise<ProviderCheckout> {
    const payment = paymentSchema.parse(
      await this.call('/payments', request.idempotencyKey, {
        amount: { value_minor: request.amount.amountMinor, currency: request.amount.currency },
        description: request.description,
        return_url: request.returnUrl,
        locale: request.locale,
        metadata: request.metadata,
        expires_at: request.expiresAt.toISOString(),
      }),
    );
    return { providerPaymentId: payment.id, checkoutUrl: payment.confirmation_url };
  }

  async refund(request: RefundRequest): Promise<{ status: 'succeeded' | 'pending' }> {
    const refund = refundSchema.parse(
      await this.call(
        `/payments/${encodeURIComponent(request.providerPaymentId)}/refunds`,
        request.idempotencyKey,
        { amount: { value_minor: request.amount.amountMinor, currency: request.amount.currency } },
      ),
    );
    return { status: refund.status };
  }

  parseWebhook(delivery: WebhookDelivery): ProviderEvent {
    const header = delivery.headers[TEST_PAY_SIGNATURE_HEADER];
    const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? '');
    const timestamp = Number(match?.[1]);
    if (!match || !Number.isSafeInteger(timestamp)) {
      throw new InvalidWebhookError('missing signature');
    }
    const age = Math.abs(this.options.now() / MS_PER_SECOND - timestamp);
    if (age > SIGNATURE_TOLERANCE_SECONDS) {
      throw new InvalidWebhookError('stale signature');
    }
    const body = delivery.rawBody.toString('utf8');
    const expected = Buffer.from(signTestPayBody(this.options.webhookSecret, timestamp, body));
    const received = Buffer.from(header ?? '');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new InvalidWebhookError('signature mismatch');
    }
    const parsed = eventSchema.safeParse(parseJson(body));
    if (!parsed.success) {
      throw new InvalidWebhookError('unexpected body');
    }
    const { payment } = parsed.data.data;
    return {
      eventId: parsed.data.id,
      kind: eventKinds[parsed.data.type],
      providerPaymentId: payment.id,
      refundedMinor: payment.refunded_minor,
      metadata: payment.metadata,
    };
  }

  private async call(path: string, idempotencyKey: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.options.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.secretKey}`,
        'idempotency-key': idempotencyKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) {
      throw new TestPayRequestError(response.status);
    }
    return response.json();
  }
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

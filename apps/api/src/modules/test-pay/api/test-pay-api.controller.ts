import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { fallbackLocale, localeIds } from '@mestechko/domain';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { TestPayEmulator, TestPayRefusal } from '../application/test-pay-emulator.js';

const amountSchema = z.object({
  value_minor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

const createSchema = z.object({
  amount: amountSchema,
  description: z.string().min(1).max(250),
  return_url: z.string().min(1).max(2000),
  /** The language of the hosted page; like real providers, a default when the shop sends none. */
  locale: z.enum(localeIds).default(fallbackLocale),
  metadata: z.record(z.string(), z.string().max(200)),
  expires_at: z.iso.datetime({ offset: true }),
});

const refundSchema = z.object({ amount: amountSchema });
const keySchema = z.string().min(1).max(64);

function sameSecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The test provider's API under `/test-pay/api`, as a shop calls it: a secret key in
 * `Authorization` and an idempotency key on every write. Mounted only in demo mode.
 */
@Controller('test-pay/api')
export class TestPayApiController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TestPayEmulator) private readonly emulator: TestPayEmulator,
  ) {}

  @Post('payments')
  @HttpCode(200)
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(authorization);
    const input = this.parse(createSchema, body);
    const payment = await this.refusals(() =>
      this.emulator.create({
        idempotencyKey: this.parse(keySchema, key),
        amountMinor: input.amount.value_minor,
        currency: input.amount.currency,
        description: input.description,
        returnUrl: input.return_url,
        locale: input.locale,
        metadata: input.metadata,
        expiresAt: new Date(input.expires_at),
      }),
    );
    return this.emulator.view(payment);
  }

  @Get('payments/:paymentId')
  async find(
    @Headers('authorization') authorization: string | undefined,
    @Param('paymentId') paymentId: string,
  ) {
    this.authorize(authorization);
    const payment = await this.emulator.find(paymentId);
    if (!payment) {
      throw new HttpException({ error: 'not_found' }, 404);
    }
    return this.emulator.view(payment);
  }

  @Post('payments/:paymentId/refunds')
  @HttpCode(200)
  async refund(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
  ) {
    this.authorize(authorization);
    const input = this.parse(refundSchema, body);
    const refund = await this.refusals(() =>
      this.emulator.refund(paymentId, this.parse(keySchema, key), input.amount.value_minor),
    );
    return { id: refund.id, status: refund.status, payment: this.emulator.view(refund.payment) };
  }

  private authorize(authorization: string | undefined): void {
    const { emulatorEnabled, secretKey } = this.config.payments.test;
    if (!emulatorEnabled || !secretKey) {
      throw new NotFoundException();
    }
    if (!sameSecret(`Bearer ${secretKey}`, authorization ?? '')) {
      throw new HttpException({ error: 'unauthorized' }, 401);
    }
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new HttpException({ error: 'invalid_request' }, 400);
    }
    return parsed.data;
  }

  private async refusals<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof TestPayRefusal) {
        throw new HttpException({ error: error.message }, error.status);
      }
      throw error;
    }
  }
}

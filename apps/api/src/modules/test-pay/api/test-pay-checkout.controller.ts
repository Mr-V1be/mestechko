import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Redirect,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import type { Clock } from '../../../shared/application/ports.js';
import { CLOCK } from '../../../shared/application/ports.js';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import { TestPayEmulator, TestPayRefusal } from '../application/test-pay-emulator.js';
import { renderCheckoutPage, type CheckoutTexts } from './checkout-page.js';

export const TEST_PAY_TEXTS = Symbol('TEST_PAY_TEXTS');
const MS_PER_MINUTE = 60_000;
const SEE_OTHER = 303;

/** The provider's hosted payment page under `/test-pay/checkout`. Demo mode only. */
@Controller('test-pay/checkout')
export class TestPayCheckoutController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TestPayEmulator) private readonly emulator: TestPayEmulator,
    @Inject(TEST_PAY_TEXTS) private readonly texts: CheckoutTexts,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get(':paymentId')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store')
  async page(@Param('paymentId') paymentId: string): Promise<string> {
    this.assertEnabled();
    const payment = await this.emulator.find(paymentId);
    if (!payment) {
      throw new NotFoundException(this.texts.text('notFound'));
    }
    const open = this.emulator.isOpen(payment);
    return renderCheckoutPage(
      {
        paymentId: payment.id,
        description: payment.description,
        amount: { amountMinor: payment.amountMinor, currency: currencyCode(payment.currency) },
        closed: open ? null : payment.status === 'succeeded' ? 'succeeded' : 'cancelled',
        minutesLeft: Math.max(
          1,
          Math.ceil(
            (payment.expiresAt.getTime() - this.clock.now().epochMilliseconds) / MS_PER_MINUTE,
          ),
        ),
        returnUrl: payment.returnUrl,
        actionBase: `${this.config.payments.test.checkoutBaseUrl}/checkout/${payment.id}`,
      },
      this.texts,
    );
  }

  @Post(':paymentId/pay')
  @HttpCode(SEE_OTHER)
  @Redirect()
  pay(@Param('paymentId') paymentId: string) {
    return this.decide(paymentId, 'pay');
  }

  @Post(':paymentId/cancel')
  @HttpCode(SEE_OTHER)
  @Redirect()
  cancel(@Param('paymentId') paymentId: string) {
    return this.decide(paymentId, 'cancel');
  }

  private async decide(paymentId: string, decision: 'pay' | 'cancel') {
    this.assertEnabled();
    try {
      return { url: await this.emulator.decide(paymentId, decision), statusCode: SEE_OTHER };
    } catch (error) {
      if (error instanceof TestPayRefusal) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private assertEnabled(): void {
    if (!this.config.payments.test.emulatorEnabled) {
      throw new NotFoundException();
    }
  }
}

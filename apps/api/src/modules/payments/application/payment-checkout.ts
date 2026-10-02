import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { PaymentProvider, PaymentStore } from './ports.js';

/** Paths of our own site only: the payment page must not send payers elsewhere. */
const RETURN_PATH = /^\/(?!\/)[\w\-./?=&%]*$/;

/**
 * Opens the provider's payment page for a pending prepayment. The provider is called
 * outside any transaction; repeating the call returns the same page.
 */
export class PaymentCheckout {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: PaymentStore,
    private readonly provider: PaymentProvider,
  ) {}

  async start(input: {
    readonly businessId: string;
    readonly paymentId: string;
    readonly description: string;
    readonly returnUrl: string;
    readonly expiresAt: Date;
    readonly now: Date;
  }): Promise<string> {
    if (!RETURN_PATH.test(input.returnUrl)) {
      throw new ApplicationError('validation_failed', 'Return address must be a path of this site');
    }
    const payment = await this.unitOfWork.inTenant(
      input.businessId,
      () => this.store.find(input.paymentId),
      { readOnly: true },
    );
    if (!payment) {
      throw notFound('Payment');
    }
    if (payment.status !== 'pending') {
      throw new ApplicationError('change_not_allowed', 'The payment is no longer open', {
        reason: 'payment_closed',
      });
    }
    if (payment.checkoutUrl) {
      return payment.checkoutUrl;
    }
    const checkout = await this.provider.createCheckout({
      idempotencyKey: payment.id,
      amount: { amountMinor: payment.amountMinor, currency: payment.currency },
      description: input.description,
      returnUrl: input.returnUrl,
      metadata: { businessId: input.businessId, paymentId: payment.id },
      expiresAt: input.expiresAt,
    });
    await this.unitOfWork.inTenant(input.businessId, () =>
      this.store.attachCheckout(payment.id, checkout, input.now),
    );
    return checkout.checkoutUrl;
  }
}

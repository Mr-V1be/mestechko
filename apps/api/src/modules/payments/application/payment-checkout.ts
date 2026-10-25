import { checkoutPresentations, type CheckoutPresentation, type Locale } from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { PaymentProvider, PaymentStore } from './ports.js';

/** Paths of our own site only: the payment page must not send payers elsewhere. */
const RETURN_PATH = /^\/(?!\/)[\w\-./?=&%]*$/;

/** The neutral page in the payer's language: it opens in a browser that may speak another. */
function withLocale(pageUrl: string, locale: Locale): string {
  const url = new URL(pageUrl);
  url.searchParams.set('locale', locale);
  return url.toString();
}

/**
 * Opens the provider's payment page for a pending prepayment. The provider is called
 * outside any transaction; repeating the call returns the same page.
 */
/** A payment page and how to open it. */
export interface OpenCheckout {
  readonly url: string;
  readonly presentation: CheckoutPresentation;
}

export class PaymentCheckout {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: PaymentStore,
    private readonly provider: PaymentProvider,
    /** The neutral page payers return to from a page opened outside the app. */
    private readonly returnPageUrl: string | null,
  ) {}

  async start(input: {
    readonly businessId: string;
    readonly paymentId: string;
    readonly description: string;
    readonly returnUrl: string;
    /** The payer's language, for the provider's page and the neutral page after it. */
    readonly locale: Locale;
    readonly expiresAt: Date;
    readonly now: Date;
  }): Promise<OpenCheckout> {
    if (!RETURN_PATH.test(input.returnUrl)) {
      throw new ApplicationError('validation_failed', 'Return address must be a path of this site');
    }
    const presentation = this.provider.presentation;
    const returnUrl = checkoutPresentations[presentation].returnsToApp
      ? input.returnUrl
      : this.returnPageUrl && withLocale(this.returnPageUrl, input.locale);
    if (returnUrl === null) {
      throw new Error('PAYMENTS_RETURN_PAGE_URL is required for a payment page outside the app');
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
      return { url: payment.checkoutUrl, presentation };
    }
    const checkout = await this.provider.createCheckout({
      idempotencyKey: payment.id,
      amount: { amountMinor: payment.amountMinor, currency: payment.currency },
      description: input.description,
      returnUrl,
      locale: input.locale,
      metadata: { businessId: input.businessId, paymentId: payment.id },
      expiresAt: input.expiresAt,
    });
    await this.unitOfWork.inTenant(input.businessId, () =>
      this.store.attachCheckout(payment.id, checkout, input.now),
    );
    return { url: checkout.checkoutUrl, presentation };
  }
}

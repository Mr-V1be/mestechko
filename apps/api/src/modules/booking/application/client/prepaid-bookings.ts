import type { ClientBooking } from '@mestechko/contracts';
import type { Clock, Locale } from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { ClientDirectory, CustomerIdentities } from '../../../clients/application/ports.js';
import type {
  OpenCheckout,
  PaymentCheckout,
} from '../../../payments/application/payment-checkout.js';
import type { PaymentProvider, WebhookDelivery } from '../../../payments/application/ports.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { BookingHolds } from '../lifecycle/booking-holds.js';
import type { BookingLifecycleStore } from '../lifecycle/ports.js';
import type { BookingFollowUps, ClientBookingQueries, PaymentDescriptions } from '../ports.js';
import type { ClientBookingPresenter } from './client-booking-presenter.js';
import type { ClientIdentity } from './client-bookings.js';

const NO_CHANGE = { freedTime: null, refunds: [] } as const;

/**
 * Bookings paid in advance: the client opens the provider's payment page, and the
 * provider's notification confirms the held booking. Money that arrives after the
 * booking stopped waiting goes back to the client.
 */
export class PrepaidBookings {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly queries: ClientBookingQueries,
    private readonly store: BookingLifecycleStore,
    private readonly holds: BookingHolds,
    private readonly prepayments: Prepayments,
    private readonly checkout: PaymentCheckout,
    private readonly provider: PaymentProvider,
    private readonly descriptions: PaymentDescriptions,
    private readonly presenter: ClientBookingPresenter,
    private readonly followUps: BookingFollowUps,
    private readonly clock: Clock,
  ) {}

  /** The payment page of the client's held booking, in the client's language. */
  async startCheckout(
    identity: ClientIdentity,
    bookingId: string,
    returnPath: string,
    locale: Locale,
  ): Promise<{ checkout: OpenCheckout; booking: ClientBooking }> {
    const context = await this.businesses.resolve(identity.business);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    const found = await this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const client = customerId ? await this.clients.findByCustomer(customerId) : null;
        const view = client ? await this.queries.get(client.id, bookingId) : null;
        const payment = view ? await this.prepayments.ofBooking(view.id) : null;
        return client && view ? { clientId: client.id, view, payment } : null;
      },
      { readOnly: true },
    );
    if (!found) {
      throw notFound('Booking');
    }
    return this.openPage(context.business.id, context.business.name, found, returnPath, locale);
  }

  /** Opens the payment page for a booking known to the caller, e.g. on a website. */
  async openPage(
    businessId: string,
    businessName: string,
    found: {
      readonly clientId: string;
      readonly view: Awaited<ReturnType<ClientBookingQueries['get']>> & object;
      readonly payment: Awaited<ReturnType<Prepayments['ofBooking']>>;
    },
    returnPath: string,
    locale: Locale,
  ): Promise<{ checkout: OpenCheckout; booking: ClientBooking }> {
    const { view, payment } = found;
    if (!view.hold || payment?.status !== 'pending') {
      throw new ApplicationError('change_not_allowed', 'The booking does not wait for a payment', {
        reason: 'not_awaiting_payment',
      });
    }
    const checkout = await this.checkout.start({
      businessId,
      paymentId: payment.id,
      description: this.descriptions.describe({
        businessName,
        serviceNames: view.services.map((service) => service.name),
        startsAt: view.startsAt,
        timeZone: view.location.timeZone,
        locale,
      }),
      returnUrl: returnPath,
      locale,
      expiresAt: view.hold.expiresAt,
      now: new Date(this.clock.now().epochMilliseconds),
    });
    const context = await this.businesses.byId(businessId);
    const booking = await this.unitOfWork.inTenant(
      businessId,
      () => this.presenter.present(context, found.clientId, view.id),
      { readOnly: true },
    );
    return { checkout, booking };
  }

  /** A notification from the payment provider; repeated deliveries change nothing. */
  async handleNotification(delivery: WebhookDelivery): Promise<void> {
    const event = this.provider.parseWebhook(delivery);
    const context = await this.businesses.byId(event.metadata.businessId);
    const businessId = context.business.id;
    const change = await this.unitOfWork.inTenant(businessId, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const outcome = await this.prepayments.apply(event, now);
      if (outcome.kind !== 'succeeded' && outcome.kind !== 'cancelled') {
        return NO_CHANGE;
      }
      const booking = await this.store.lock(outcome.payment.bookingId);
      const awaiting = booking && this.holds.awaitsPayment(booking) ? booking : null;
      if (outcome.kind === 'cancelled') {
        // The client turned the payment down: the held time goes back to others at once.
        return awaiting
          ? {
              freedTime: await this.holds.release(businessId, awaiting, 'declined', now),
              refunds: [],
            }
          : NO_CHANGE;
      }
      if (awaiting) {
        await this.holds.confirm(context, awaiting, { seenByClient: false }, now);
        return NO_CHANGE;
      }
      // Paid after the hold ran out or the booking was cancelled: the money goes back.
      const refund = await this.prepayments.requestRefund(
        outcome.payment.bookingId,
        outcome.payment.amountMinor,
        now,
      );
      return { freedTime: null, refunds: refund ? [refund] : [] };
    });
    await this.followUps.afterCommit({ businessId, ...change });
  }
}

import type { WidgetBooking } from '@mestechko/contracts';
import type { Clock, Money } from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { RateLimiter } from '../../../../shared/application/rate-limits.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import { clientContactOf } from '../../../clients/application/client-contact-policy.js';
import type { ClientDirectory } from '../../../clients/application/ports.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../../tenancy/application/business-context.js';
import type { BookingNotifier } from '../lifecycle/booking-notifier.js';
import type {
  BookingFollowUps,
  BookingTokens,
  ClientBookingQueries,
  ClientBookingView,
} from '../ports.js';
import type { BookingPlacement } from './booking-placement.js';
import type { PrepaidBookings } from './prepaid-bookings.js';

export interface WebsiteBookingCommand {
  readonly slug: string;
  readonly visitorAddress: string;
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  readonly agreedTotal: Money;
  readonly contact: { readonly name: string; readonly phone: string };
  readonly comment: string | null;
  readonly returnPath: string;
}

/**
 * Bookings from the business's website widget. Visitors are matched to client cards
 * by phone; a token signed for the booking lets them see it later, and a prepayment
 * opens the payment page straight away.
 */
export class WebsiteBookings {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly clients: ClientDirectory,
    private readonly queries: ClientBookingQueries,
    private readonly placement: BookingPlacement,
    private readonly prepayments: Prepayments,
    private readonly prepaid: PrepaidBookings,
    private readonly notifier: BookingNotifier,
    private readonly tokens: BookingTokens,
    private readonly limits: RateLimiter,
    private readonly followUps: BookingFollowUps,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(command: WebsiteBookingCommand) {
    const verdict = await this.limits.consume('website_booking', command.visitorAddress);
    if (!verdict.allowed) {
      throw new ApplicationError('rate_limited', 'Too many bookings from this address', {
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
    }
    const context = await this.businesses.bySlug(command.slug);
    const businessId = context.business.id;
    const contact = clientContactOf(command.contact, {
      demoNumbersAllowed: context.business.isDemo,
    });
    const placed = await this.unitOfWork.inTenant(businessId, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const client =
        (await this.clients.findByPhone(contact.phone)) ??
        (await this.clients.create({
          id: this.ids.next(),
          displayName: contact.displayName,
          phone: contact.phone,
          email: null,
          tags: [],
          now,
        }));
      const placement = await this.placement.place(
        context,
        {
          clientId: client.id,
          source: 'widget',
          idempotencyKey: command.idempotencyKey,
          locationId: command.locationId,
          serviceIds: command.serviceIds,
          staffId: command.staffId,
          start: command.start,
          comment: command.comment,
          agreedTotal: command.agreedTotal,
        },
        now,
      );
      if (placement.isNew && !placement.awaitsPayment) {
        await this.notifier.plan({
          businessId,
          booking: {
            id: placement.id,
            version: 1,
            startsAt: placement.startsAt,
            source: 'widget',
            customerId: client.customerId,
          },
          event: 'created',
          seenByClient: false,
          now,
        });
      }
      return { clientId: client.id, placement };
    });
    await this.followUps.afterCommit({ businessId, freedTime: null });
    const bookingId = placed.placement.id;
    const token = this.tokens.issue(bookingId);
    const checkoutUrl = placed.placement.awaitsPayment
      ? await this.checkoutOf(context, placed.clientId, bookingId, command.returnPath, token)
      : null;
    return { booking: await this.view(context, bookingId), token, checkoutUrl };
  }

  async get(slug: string, bookingId: string, token: string): Promise<WidgetBooking> {
    if (!this.tokens.verify(bookingId, token)) {
      throw notFound('Booking');
    }
    return this.view(await this.businesses.bySlug(slug), bookingId);
  }

  private async checkoutOf(
    context: BusinessContext,
    clientId: string,
    bookingId: string,
    returnPath: string,
    token: string,
  ): Promise<string> {
    const found = await this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const view = await this.queries.get(clientId, bookingId);
        return view ? { view, payment: await this.prepayments.ofBooking(bookingId) } : null;
      },
      { readOnly: true },
    );
    if (!found) {
      throw notFound('Booking');
    }
    const separator = returnPath.includes('?') ? '&' : '?';
    const page = await this.prepaid.openPage(
      context.business.id,
      context.business.name,
      { clientId, ...found },
      `${returnPath}${separator}booking=${bookingId}&token=${token}`,
    );
    return page.checkoutUrl;
  }

  private async view(context: BusinessContext, bookingId: string): Promise<WidgetBooking> {
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const clientId = await this.queries.clientOf(bookingId);
        const view = clientId ? await this.queries.get(clientId, bookingId) : null;
        if (!view) {
          throw notFound('Booking');
        }
        return toWidgetBooking(view, await this.prepayments.ofBooking(bookingId));
      },
      { readOnly: true },
    );
  }
}

function toWidgetBooking(
  view: ClientBookingView,
  payment: Awaited<ReturnType<Prepayments['ofBooking']>>,
): WidgetBooking {
  const money = (amountMinor: number) => ({ amountMinor, currency: view.currency });
  return {
    id: view.id,
    status: view.status,
    hold: view.hold
      ? { reason: view.hold.reason, expiresAt: view.hold.expiresAt.toISOString() }
      : null,
    start: view.startsAt.toISOString(),
    end: view.endsAt.toISOString(),
    location: view.location,
    staffName: view.staff.displayName,
    serviceNames: view.services.map((service) => service.name),
    total: money(view.totalPriceMinor),
    deposit: view.depositMinor > 0 ? money(view.depositMinor) : null,
    paymentStatus: payment?.status ?? null,
  };
}

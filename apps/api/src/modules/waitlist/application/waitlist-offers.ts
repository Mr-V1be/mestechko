import type { ClientBooking } from '@slotwise/contracts';
import {
  holdExpiry,
  waitlistOfferStatuses,
  waitlistStatuses,
  type Clock,
  type MessengerChannel,
} from '@slotwise/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { ClientBookingPresenter } from '../../booking/application/client/client-booking-presenter.js';
import type { ClientIdentity } from '../../booking/application/client/client-bookings.js';
import type { BookingCancellation } from '../../booking/application/lifecycle/booking-cancellation.js';
import type { BookingHolds } from '../../booking/application/lifecycle/booking-holds.js';
import type {
  BookingLifecycleStore,
  LockedBooking,
} from '../../booking/application/lifecycle/ports.js';
import type {
  BookingFollowUps,
  ClientBookingQueries,
  CommittedBookingChange,
} from '../../booking/application/ports.js';
import type { ClientDirectory, CustomerIdentities } from '../../clients/application/ports.js';
import type { Prepayments } from '../../payments/application/prepayments.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../tenancy/application/business-context.js';
import type { WaitlistEntryView, WaitlistOfferRecord, WaitlistStore } from './ports.js';

/** An offered time as the client sees it. */
export interface WaitlistOffer {
  readonly entry: WaitlistEntryView;
  readonly startsAt: Date;
  readonly totalMinor: number;
  /** Until when the time is kept for the client. */
  readonly holdsUntil: Date;
}

interface OwnOffer {
  readonly context: BusinessContext;
  readonly clientId: string;
  readonly offer: WaitlistOfferRecord;
  readonly booking: LockedBooking;
}

const closed = () =>
  new ApplicationError('change_not_allowed', 'The offer is no longer open', {
    reason: 'offer_closed',
  });

/**
 * The client's answer to an offer: accepting keeps the held time for them (until the
 * prepayment, if one is due), declining frees it for the next in line.
 */
export class WaitlistOffers {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly store: WaitlistStore,
    private readonly lifecycle: BookingLifecycleStore,
    private readonly queries: ClientBookingQueries,
    private readonly holds: BookingHolds,
    private readonly cancellation: BookingCancellation,
    private readonly prepayments: Prepayments,
    private readonly presenter: ClientBookingPresenter,
    private readonly followUps: BookingFollowUps,
    private readonly clock: Clock,
  ) {}

  /** The offer while it is open; `null` once it was answered, withdrawn or ran out. */
  async describe(
    businessId: string,
    entryId: string,
    startsAt: Date,
    totalMinor: number,
  ): Promise<WaitlistOffer | null> {
    return this.unitOfWork.inTenant(
      businessId,
      async () => {
        const [entry, offer] = await Promise.all([
          this.store.find(entryId),
          this.store.findOffer(entryId, startsAt),
        ]);
        if (!entry || !waitlistStatuses[entry.status].open || !offer) {
          return null;
        }
        if (!waitlistOfferStatuses[offer.status].open) {
          return null;
        }
        const booking = await this.queries.get(entry.clientId, offer.bookingId);
        return booking?.hold
          ? { entry, startsAt, totalMinor, holdsUntil: booking.hold.expiresAt }
          : null;
      },
      { readOnly: true },
    );
  }

  /** Keeps the offered time for the client; a prepayment, if due, holds it a while longer. */
  async accept(identity: ClientIdentity, entryId: string, startsAt: Date): Promise<ClientBooking> {
    const { businessId, value } = await this.answer(
      identity,
      entryId,
      startsAt,
      async (own, now) => {
        if (own.booking.depositMinor > 0) {
          await this.lifecycle.rehold(
            own.booking,
            {
              reason: 'payment',
              expiresAt: new Date(holdExpiry('payment', own.context.rules, now.getTime())),
            },
            now,
          );
          await this.prepayments.open({
            bookingId: own.booking.id,
            clientId: own.clientId,
            amount: { amountMinor: own.booking.depositMinor, currency: own.booking.currency },
            now,
          });
        } else {
          await this.holds.confirm(own.context, own.booking, { seenByClient: true }, now);
        }
        await this.store.closeOffer(own.offer.id, 'accepted', now);
        await this.store.markBooked(entryId, own.booking.id, now);
        return {
          change: { freedTime: null },
          value: () => this.presenter.present(own.context, own.clientId, own.booking.id),
        };
      },
    );
    await this.followUps.afterCommit({ businessId, freedTime: null });
    return value;
  }

  /** Frees the offered time for the next in line; the wish stays open. */
  async decline(identity: ClientIdentity, entryId: string, startsAt: Date): Promise<void> {
    const { businessId, change } = await this.answer(
      identity,
      entryId,
      startsAt,
      async (own, now) => {
        await this.store.closeOffer(own.offer.id, 'declined', now);
        const outcome = await this.cancellation.cancel(own.booking, {
          businessId: own.context.business.id,
          actor: 'client',
          channel: identity.channel,
          actorUserId: null,
          refundsDeposit: false,
          seenByClient: true,
          now,
        });
        return { change: { freedTime: outcome.freedTime }, value: () => Promise.resolve() };
      },
    );
    await this.followUps.afterCommit({ businessId, ...change });
  }

  /** Takes an offer from the Mini App, which knows the held booking rather than the offer. */
  async acceptForBooking(identity: ClientIdentity, bookingId: string): Promise<ClientBooking> {
    const offer = await this.offerFor(identity, bookingId);
    return this.accept(identity, offer.entryId, offer.startsAt);
  }

  /** Passes an offer on from the Mini App. */
  async declineForBooking(identity: ClientIdentity, bookingId: string): Promise<void> {
    const offer = await this.offerFor(identity, bookingId);
    await this.decline(identity, offer.entryId, offer.startsAt);
  }

  /** The offer behind a held booking; whose it is, the answer itself checks. */
  private async offerFor(
    identity: ClientIdentity,
    bookingId: string,
  ): Promise<WaitlistOfferRecord> {
    const context = await this.businesses.resolve(identity.business);
    const offer = await this.unitOfWork.inTenant(
      context.business.id,
      () => this.store.offerOfBooking(bookingId),
      { readOnly: true },
    );
    if (!offer) {
      throw notFound('Offer');
    }
    return offer;
  }

  /** Withdraws the offer of a wish the client gave up, releasing its time. */
  async withdraw(
    entryId: string,
    channel: MessengerChannel,
    context: BusinessContext,
    now: Date,
  ): Promise<CommittedBookingChange['freedTime']> {
    const offer = await this.store.pendingOfferOf(entryId);
    if (!offer) {
      return null;
    }
    await this.store.closeOffer(offer.id, 'withdrawn', now);
    const booking = await this.lifecycle.lock(offer.bookingId);
    if (!booking?.hold) {
      return null;
    }
    const outcome = await this.cancellation.cancel(booking, {
      businessId: context.business.id,
      actor: 'client',
      channel,
      actorUserId: null,
      refundsDeposit: false,
      seenByClient: true,
      now,
    });
    return outcome.freedTime;
  }

  /** Runs an answer to the client's own open offer in one tenant transaction. */
  private async answer<T>(
    identity: ClientIdentity,
    entryId: string,
    startsAt: Date,
    apply: (
      own: OwnOffer,
      now: Date,
    ) => Promise<{
      readonly change: Omit<CommittedBookingChange, 'businessId'>;
      readonly value: () => Promise<T>;
    }>,
  ): Promise<{ businessId: string; change: Omit<CommittedBookingChange, 'businessId'>; value: T }> {
    const context = await this.businesses.resolve(identity.business);
    const businessId = context.business.id;
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    const result = await this.unitOfWork.inTenant(businessId, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const client = customerId ? await this.clients.findByCustomer(customerId) : null;
      const entry = await this.store.find(entryId);
      if (!client || entry?.clientId !== client.id) {
        throw notFound('Offer');
      }
      const offer = await this.store.findOffer(entryId, startsAt);
      const booking = offer ? await this.lifecycle.lock(offer.bookingId) : null;
      if (!offer || !waitlistOfferStatuses[offer.status].open || !booking?.hold) {
        throw closed();
      }
      const applied = await apply({ context, clientId: client.id, offer, booking }, now);
      return { change: applied.change, value: await applied.value() };
    });
    return { businessId, ...result };
  }
}

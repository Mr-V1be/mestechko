import type { ClientBooking } from '@mestechko/contracts';
import { messengerBookingSource, waitlistStatuses, type Clock } from '@mestechko/domain';
import { createHash } from 'node:crypto';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { ClientIdentity } from '../../booking/application/client/client-bookings.js';
import type { CreateClientBooking } from '../../booking/application/client/create-client-booking.js';
import type { BookingFollowUps } from '../../booking/application/ports.js';
import type { CustomerIdentities } from '../../clients/application/ports.js';
import type { NotificationStore } from '../../notifications/application/ports.js';
import type { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import type { WaitlistEntryView, WaitlistStore } from './ports.js';

/** An offered time as the client sees it. */
export interface WaitlistOffer {
  readonly entry: WaitlistEntryView;
  readonly startsAt: Date;
  readonly totalMinor: number;
}

/** Idempotency key of an acceptance: pressing twice books once. */
function acceptanceKey(entryId: string, startsAt: Date): string {
  const hex = createHash('sha256').update(`${entryId}:${startsAt.toISOString()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Offers of freed time and the client's answer to them. */
export class WaitlistOffers {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly store: WaitlistStore,
    private readonly notifications: NotificationStore,
    private readonly createBooking: CreateClientBooking,
    private readonly followUps: BookingFollowUps,
    private readonly clock: Clock,
  ) {}

  /** The offer if the wish is still open; `null` once it was booked or withdrawn. */
  async describe(
    businessId: string,
    entryId: string,
    startsAt: Date,
    totalMinor: number,
  ): Promise<WaitlistOffer | null> {
    const entry = await this.unitOfWork.inTenant(businessId, () => this.store.find(entryId), {
      readOnly: true,
    });
    return entry && waitlistStatuses[entry.status].open ? { entry, startsAt, totalMinor } : null;
  }

  /** Books the offered time at the offered price for the client it was offered to. */
  async accept(identity: ClientIdentity, entryId: string, startsAt: Date): Promise<ClientBooking> {
    const context = await this.businesses.resolve(identity.business);
    const offer = await this.notifications.findOffer(entryId, startsAt);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    const totalMinor = offer?.customerId === customerId ? offer.offerTotalMinor : null;
    if (totalMinor === null) {
      throw notFound('Offer');
    }
    const booking = await this.unitOfWork.inTenant(context.business.id, async () => {
      const entry = await this.store.find(entryId);
      if (!entry || !waitlistStatuses[entry.status].open) {
        throw new ApplicationError('change_not_allowed', 'The wish is no longer open', {
          reason: 'offer_closed',
        });
      }
      const created = await this.createBooking.bookInTenant(context, {
        business: identity.business,
        channel: identity.channel,
        source: messengerBookingSource(identity.channel, 'chat'),
        externalUserId: identity.externalUserId,
        idempotencyKey: acceptanceKey(entryId, startsAt),
        locationId: entry.locationId,
        serviceIds: entry.serviceIds,
        staffId: entry.staffId,
        start: startsAt.toISOString(),
        contact: null,
        comment: null,
        agreedTotal: { amountMinor: totalMinor, currency: context.business.currency },
        surface: 'chat',
      });
      await this.store.markBooked(
        entryId,
        created.id,
        new Date(this.clock.now().epochMilliseconds),
      );
      return created;
    });
    await this.followUps.afterCommit({ businessId: context.business.id, freedTime: null });
    return booking;
  }
}

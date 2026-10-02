import type { WaitlistEntry } from '@mestechko/contracts';
import {
  localDateOf,
  Temporal,
  waitlistWindowOf,
  type Clock,
  type DayPart,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { ClientIdentity } from '../../booking/application/client/client-bookings.js';
import type { CatalogReader } from '../../catalog/application/catalog-reader.js';
import type {
  ClientContact,
  ClientDirectory,
  CustomerIdentities,
} from '../../clients/application/ports.js';
import type { BookingFollowUps } from '../../booking/application/ports.js';
import type { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import type { WaitlistStore } from './ports.js';
import type { WaitlistOffers } from './waitlist-offers.js';
import { toWaitlistEntry } from './waitlist-view.js';

export interface WaitlistWish {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly date: string;
  readonly dayPart: DayPart | null;
  readonly contact: ClientContact;
}

/** A client's wishes to be offered a free time when one appears. */
export class WaitlistEntries {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly catalog: CatalogReader,
    private readonly store: WaitlistStore,
    private readonly offers: WaitlistOffers,
    private readonly followUps: BookingFollowUps,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async join(identity: ClientIdentity, wish: WaitlistWish): Promise<WaitlistEntry> {
    const context = await this.businesses.resolve(identity.business);
    return this.unitOfWork.inTenant(context.business.id, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const location = await this.catalog.findLocation(wish.locationId);
      if (!location) {
        throw notFound('Location');
      }
      const today = localDateOf(now.getTime(), location.timeZone);
      const date = Temporal.PlainDate.from(wish.date);
      const days = today.until(date, { largestUnit: 'days' }).days;
      if (days < 0 || days > context.rules.horizonDays) {
        throw new ApplicationError('validation_failed', 'The day is outside the booking horizon');
      }
      const services = await this.catalog.listServices(wish.serviceIds);
      if (
        services.length !== new Set(wish.serviceIds).size ||
        wish.serviceIds.length > context.rules.maxServicesPerBooking
      ) {
        throw notFound('Service');
      }
      if (wish.staffId && (await this.catalog.listStaff([wish.staffId])).length === 0) {
        throw notFound('Staff member');
      }
      const customerId = await this.customers.ensure(
        identity.channel,
        identity.externalUserId,
        now,
      );
      const client = await this.clients.upsertForCustomer(customerId, wish.contact, {
        newId: this.ids.next(),
        now,
      });
      const id = await this.store.saveOpen({
        id: this.ids.next(),
        clientId: client.id,
        locationId: location.id,
        staffId: wish.staffId,
        serviceIds: wish.serviceIds,
        date: date.toString(),
        window: waitlistWindowOf(wish.dayPart),
        channel: identity.channel,
        now,
      });
      const saved = await this.store.find(id);
      if (!saved) {
        throw new Error(`Waitlist entry ${id} vanished inside its transaction`);
      }
      return toWaitlistEntry(saved);
    });
  }

  async list(identity: ClientIdentity): Promise<WaitlistEntry[]> {
    const context = await this.businesses.resolve(identity.business);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    if (!customerId) {
      return [];
    }
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const client = await this.clients.findByCustomer(customerId);
        if (!client) {
          return [];
        }
        const locations = await this.catalog.listLocations();
        // Days already over in every location are history, not wishes.
        const earliestToday = locations
          .map((location) =>
            localDateOf(this.clock.now().epochMilliseconds, location.timeZone).toString(),
          )
          .sort()[0];
        const entries = await this.store.listOpenForClient(
          client.id,
          earliestToday ?? '0000-01-01',
        );
        const now = this.clock.now().epochMilliseconds;
        return entries
          .filter((entry) => entry.date >= localDateOf(now, entry.location.timeZone).toString())
          .map(toWaitlistEntry);
      },
      { readOnly: true },
    );
  }

  /** Gives up a wish; time held for it by an open offer goes to the next in line. */
  async leave(identity: ClientIdentity, entryId: string): Promise<void> {
    const context = await this.businesses.resolve(identity.business);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    const freedTime = await this.unitOfWork.inTenant(context.business.id, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const client = customerId ? await this.clients.findByCustomer(customerId) : null;
      const left = client !== null && (await this.store.cancel(entryId, client.id, now));
      if (!left) {
        throw notFound('Waitlist entry');
      }
      return this.offers.withdraw(entryId, identity.channel, context, now);
    });
    await this.followUps.afterCommit({ businessId: context.business.id, freedTime });
  }
}

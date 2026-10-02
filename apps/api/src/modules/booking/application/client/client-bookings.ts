import type { BookingScope, ClientBooking } from '@mestechko/contracts';
import type { Clock, MessengerChannel } from '@mestechko/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { ClientDirectory, CustomerIdentities } from '../../../clients/application/ports.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { ClientBookingQueries } from '../ports.js';
import { toClientBooking } from './client-booking-view.js';

const PAGE_SIZE = 20;

export interface ClientIdentity {
  readonly businessSlug: string;
  readonly channel: MessengerChannel;
  readonly externalUserId: string;
}

/** A client's own bookings and contact details within one business. */
export class ClientBookings {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly queries: ClientBookingQueries,
    private readonly avatars: AvatarUrls,
    private readonly clock: Clock,
  ) {}

  async list(
    identity: ClientIdentity,
    scope: BookingScope,
    cursor: string | null,
  ): Promise<{ items: ClientBooking[]; nextCursor: string | null }> {
    return this.withClient(identity, async (clientId) => {
      if (!clientId) {
        return { items: [], nextCursor: null };
      }
      const now = new Date(this.clock.now().epochMilliseconds);
      const page = await this.queries.list(clientId, scope, now, { cursor, limit: PAGE_SIZE });
      return {
        items: page.items.map((view) => toClientBooking(view, this.avatars)),
        nextCursor: page.nextCursor,
      };
    });
  }

  async get(identity: ClientIdentity, bookingId: string): Promise<ClientBooking> {
    return this.withClient(identity, async (clientId) => {
      const view = clientId ? await this.queries.get(clientId, bookingId) : null;
      if (!view) {
        throw notFound('Booking');
      }
      return toClientBooking(view, this.avatars);
    });
  }

  async profile(
    identity: ClientIdentity,
  ): Promise<{ displayName: string | null; phone: string | null }> {
    const { business } = await this.businesses.bySlug(identity.businessSlug);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    if (!customerId) {
      return { displayName: null, phone: null };
    }
    const client = await this.unitOfWork.inTenant(
      business.id,
      () => this.clients.findByCustomer(customerId),
      {
        readOnly: true,
      },
    );
    return { displayName: client?.displayName ?? null, phone: client?.phone ?? null };
  }

  /** Runs reads for the client card of the identity; `null` when they never booked here. */
  private async withClient<T>(
    identity: ClientIdentity,
    work: (clientId: string | null) => Promise<T>,
  ): Promise<T> {
    const { business } = await this.businesses.bySlug(identity.businessSlug);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    return this.unitOfWork.inTenant(
      business.id,
      async () => {
        const client = customerId ? await this.clients.findByCustomer(customerId) : null;
        return work(client?.id ?? null);
      },
      { readOnly: true },
    );
  }
}

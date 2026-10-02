import type { BookingScope, ClientBooking } from '@mestechko/contracts';
import type { Clock, MessengerChannel } from '@mestechko/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type {
  ClientDirectory,
  ClientRecord,
  CustomerIdentities,
} from '../../../clients/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
  BusinessKey,
} from '../../../tenancy/application/business-context.js';
import type { ClientBookingQueries } from '../ports.js';
import { toClientBooking } from './client-booking-view.js';

const PAGE_SIZE = 20;

/** A client as a messenger account in one business. */
export interface ClientIdentity {
  readonly business: BusinessKey;
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
    limit: number = PAGE_SIZE,
  ): Promise<{ items: ClientBooking[]; nextCursor: string | null }> {
    return this.withClient(identity, async (client, context) => {
      if (!client) {
        return { items: [], nextCursor: null };
      }
      const now = this.clock.now().epochMilliseconds;
      const page = await this.queries.list(client.id, scope, new Date(now), { cursor, limit });
      return {
        items: page.items.map((view) =>
          toClientBooking(view, this.avatars, context.rules.clientChanges, now),
        ),
        nextCursor: page.nextCursor,
      };
    });
  }

  async get(identity: ClientIdentity, bookingId: string): Promise<ClientBooking> {
    return this.withClient(identity, async (client, context) => {
      const view = client ? await this.queries.get(client.id, bookingId) : null;
      if (!view) {
        throw notFound('Booking');
      }
      return toClientBooking(
        view,
        this.avatars,
        context.rules.clientChanges,
        this.clock.now().epochMilliseconds,
      );
    });
  }

  /** A booking of the client card a customer has in the business. */
  async getForCustomer(
    businessId: string,
    customerId: string,
    bookingId: string,
  ): Promise<ClientBooking | null> {
    const context = await this.businesses.byId(businessId);
    return this.unitOfWork.inTenant(
      businessId,
      async () => {
        const client = await this.clients.findByCustomer(customerId);
        const view = client ? await this.queries.get(client.id, bookingId) : null;
        return view
          ? toClientBooking(
              view,
              this.avatars,
              context.rules.clientChanges,
              this.clock.now().epochMilliseconds,
            )
          : null;
      },
      { readOnly: true },
    );
  }

  async profile(
    identity: ClientIdentity,
  ): Promise<{ displayName: string | null; phone: string | null }> {
    return this.withClient(identity, (client) =>
      Promise.resolve({
        displayName: client?.displayName ?? null,
        phone: client?.phone ?? null,
      }),
    );
  }

  /** Runs reads for the client card of the identity; `null` when they never booked here. */
  private async withClient<T>(
    identity: ClientIdentity,
    work: (client: ClientRecord | null, context: BusinessContext) => Promise<T>,
  ): Promise<T> {
    const context = await this.businesses.resolve(identity.business);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const client = customerId ? await this.clients.findByCustomer(customerId) : null;
        return work(client, context);
      },
      { readOnly: true },
    );
  }
}

import type { ClientBooking } from '@mestechko/contracts';
import {
  initialBookingStatus,
  localDateOf,
  planBookingOptions,
  priceRange,
  withinAgreedPrice,
  type BookingSource,
  type Clock,
  type MessengerChannel,
  type Money,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { CatalogReader, ServiceView } from '../../../catalog/application/catalog-reader.js';
import type { ClientDirectory, CustomerIdentities } from '../../../clients/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { pricePlans, serviceOf, type PricedPlan } from '../availability/plan-pricing.js';
import {
  DuplicateRequestError,
  SlotConflictError,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
  type NewBooking,
} from '../ports.js';
import { toClientBooking } from './client-booking-view.js';

export interface CreateClientBookingCommand {
  readonly businessSlug: string;
  readonly channel: MessengerChannel;
  readonly source: BookingSource;
  readonly externalUserId: string;
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  readonly contact: { readonly name: string; readonly phone: string };
  readonly comment: string | null;
  /** Total the client confirmed; the booking never costs more. */
  readonly agreedTotal: Money;
}

const MS_PER_MINUTE = 60_000;
/** Bounded retries after concurrent conflicts; each one re-plans on fresh data. */
const MAX_ATTEMPTS = 4;

/**
 * Books a free start for a client. The engine proposes conflict-free plans; the
 * database has the final word through exclusion constraints, so a concurrent booking
 * of the same time makes this attempt fall through to the next qualified staff member.
 */
export class CreateClientBooking {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: CatalogReader,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly assembler: AvailabilityAssembler,
    private readonly writer: BookingWriter,
    private readonly queries: ClientBookingQueries,
    private readonly telemetry: BookingTelemetry,
    private readonly avatars: AvatarUrls,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateClientBookingCommand): Promise<ClientBooking> {
    const context = await this.businesses.bySlug(command.businessSlug);
    return this.unitOfWork.inTenant(context.business.id, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const customerId = await this.customers.ensure(command.channel, command.externalUserId, now);
      const client = await this.clients.upsertForCustomer(
        customerId,
        { displayName: command.contact.name, phone: command.contact.phone },
        { newId: this.ids.next(), now },
      );
      const repeated = await this.queries.findIdByIdempotencyKey(client.id, command.idempotencyKey);
      if (repeated) {
        return this.load(client.id, repeated);
      }
      const bookingId = await this.book(context, command, client.id, now);
      return this.load(client.id, bookingId);
    });
  }

  private async book(
    context: BusinessContext,
    command: CreateClientBookingCommand,
    clientId: string,
    now: Date,
  ): Promise<string> {
    const location = await this.catalog.findLocation(command.locationId);
    if (!location) {
      throw notFound('Location');
    }
    const start = Date.parse(command.start);
    const date = localDateOf(start, location.timeZone);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // Each attempt re-reads occupancy: after a conflict the competing booking is
      // committed and visible, so the next plan picks another staff member or resource.
      const assembled = await this.assembler.assemble({
        context,
        locationId: location.id,
        serviceIds: command.serviceIds,
        staffId: command.staffId,
        from: date,
        to: date,
        now: this.clock.now(),
      });
      const priced = pricePlans(
        planBookingOptions(assembled.request, start),
        assembled,
        context.business.currency,
      );
      if (priced.length === 0) {
        break;
      }
      const option = withinAgreedPrice(priced, command.agreedTotal)[0];
      if (!option) {
        throw new ApplicationError('price_changed', 'The price of this time has changed', {
          range: priceRange(priced.map((candidate) => candidate.total)),
        });
      }
      const booking = this.toNewBooking(
        context,
        command,
        clientId,
        option,
        assembled.services,
        now,
      );
      try {
        await this.writer.insert(booking);
        this.telemetry.bookingCreated(command.source);
        return booking.id;
      } catch (error) {
        if (error instanceof DuplicateRequestError) {
          const existing = await this.queries.findIdByIdempotencyKey(
            clientId,
            command.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        if (!(error instanceof SlotConflictError)) {
          throw error;
        }
        this.telemetry.slotConflict();
      }
    }
    throw new ApplicationError('slot_unavailable', 'The chosen time is no longer available');
  }

  private toNewBooking(
    context: BusinessContext,
    command: CreateClientBookingCommand,
    clientId: string,
    option: PricedPlan,
    services: readonly ServiceView[],
    now: Date,
  ): NewBooking {
    const { plan, quote } = option;
    return {
      id: this.ids.next(),
      locationId: command.locationId,
      clientId,
      staffId: plan.staffId,
      status: initialBookingStatus,
      source: command.source,
      startsAt: new Date(plan.start),
      endsAt: new Date(plan.end),
      totalPriceMinor: quote.total.amountMinor,
      currency: context.business.currency,
      comment: command.comment,
      idempotencyKey: command.idempotencyKey,
      createdAt: now,
      items: plan.items.map((item, position) => ({
        id: this.ids.next(),
        position,
        serviceId: item.serviceId,
        serviceName: serviceOf(services, item.serviceId).name,
        durationMinutes: (item.end - item.start) / MS_PER_MINUTE,
        priceMinor:
          quote.items[position]?.price.amountMinor ??
          serviceOf(services, item.serviceId).priceMinor,
        resourceId: item.resourceId,
        startsAt: new Date(item.start),
        endsAt: new Date(item.end),
        occupied: { start: new Date(item.occupied.start), end: new Date(item.occupied.end) },
      })),
    };
  }

  private async load(clientId: string, bookingId: string): Promise<ClientBooking> {
    const view = await this.queries.get(clientId, bookingId);
    if (!view) {
      throw new Error(`Booking ${bookingId} vanished inside its transaction`);
    }
    return toClientBooking(view, this.avatars);
  }
}

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
import type {
  ClientContact,
  ClientDirectory,
  ClientRecord,
  CustomerIdentities,
} from '../../../clients/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
  BusinessKey,
} from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { pricePlans, type PricedPlan } from '../availability/plan-pricing.js';
import { bookingItemsOf } from '../booking-items.js';
import type { BookingNotifier } from '../lifecycle/booking-notifier.js';
import {
  DuplicateRequestError,
  SlotConflictError,
  type BookingFollowUps,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
  type NewBooking,
} from '../ports.js';
import { toClientBooking } from './client-booking-view.js';

export interface CreateClientBookingCommand {
  readonly business: BusinessKey;
  readonly channel: MessengerChannel;
  readonly source: BookingSource;
  readonly externalUserId: string;
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  /** Contact to save on the client card; `null` books with the card the client already has. */
  readonly contact: ClientContact | null;
  readonly comment: string | null;
  /** Total the client confirmed; the booking never costs more. */
  readonly agreedTotal: Money;
  /** In a chat the client sees the booking in the message they pressed; no notice follows. */
  readonly surface: 'web_app' | 'chat';
}
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
    private readonly notifier: BookingNotifier,
    private readonly followUps: BookingFollowUps,
    private readonly avatars: AvatarUrls,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateClientBookingCommand): Promise<ClientBooking> {
    const context = await this.businesses.resolve(command.business);
    const booking = await this.unitOfWork.inTenant(context.business.id, () =>
      this.bookInTenant(context, command),
    );
    await this.followUps.afterCommit({ businessId: context.business.id, freedTime: null });
    return booking;
  }

  /**
   * Books inside the caller's tenant transaction, so the caller can commit more with
   * it; the caller runs the follow-ups once it commits.
   */
  async bookInTenant(
    context: BusinessContext,
    command: CreateClientBookingCommand,
  ): Promise<ClientBooking> {
    const now = new Date(this.clock.now().epochMilliseconds);
    const customerId = await this.customers.ensure(command.channel, command.externalUserId, now);
    const client = await this.clientCard(customerId, command.contact, now);
    const repeated = await this.queries.findIdByIdempotencyKey(client.id, command.idempotencyKey);
    if (repeated) {
      return this.load(context, client.id, repeated);
    }
    const created = await this.book(context, command, client.id, now);
    if (!created.isNew) {
      return this.load(context, client.id, created.id);
    }
    await this.notifier.plan({
      businessId: context.business.id,
      booking: {
        id: created.id,
        version: 1,
        startsAt: created.startsAt,
        source: command.source,
        customerId,
      },
      event: 'created',
      seenByClient: command.surface === 'chat',
      now,
    });
    return this.load(context, client.id, created.id);
  }

  private async clientCard(
    customerId: string,
    contact: ClientContact | null,
    now: Date,
  ): Promise<ClientRecord> {
    if (contact) {
      return this.clients.upsertForCustomer(customerId, contact, { newId: this.ids.next(), now });
    }
    const existing = await this.clients.findByCustomer(customerId);
    if (!existing) {
      throw notFound('Client');
    }
    return existing;
  }

  private async book(
    context: BusinessContext,
    command: CreateClientBookingCommand,
    clientId: string,
    now: Date,
  ): Promise<{ id: string; startsAt: Date; isNew: boolean }> {
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
        return { id: booking.id, startsAt: booking.startsAt, isNew: true };
      } catch (error) {
        if (error instanceof DuplicateRequestError) {
          const existing = await this.queries.findIdByIdempotencyKey(
            clientId,
            command.idempotencyKey,
          );
          if (existing) {
            return { id: existing, startsAt: booking.startsAt, isNew: false };
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
      items: bookingItemsOf(option, services, this.ids),
    };
  }

  private async load(
    context: BusinessContext,
    clientId: string,
    bookingId: string,
  ): Promise<ClientBooking> {
    const view = await this.queries.get(clientId, bookingId);
    if (!view) {
      throw new Error(`Booking ${bookingId} vanished inside its transaction`);
    }
    return toClientBooking(
      view,
      this.avatars,
      context.rules.clientChanges,
      this.clock.now().epochMilliseconds,
    );
  }
}

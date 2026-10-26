import {
  holdExpiry,
  holdReasons,
  initialBookingStatus,
  localDateOf,
  planBookingOptions,
  priceRange,
  withinAgreedPrice,
  type BookingSource,
  type Clock,
  type Money,
} from '@slotwise/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { CatalogReader } from '../../../catalog/application/catalog-reader.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type { BusinessContext } from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { depositOf, pricePlans } from '../availability/plan-pricing.js';
import { bookingItemsOf } from '../booking-items.js';
import {
  DuplicateRequestError,
  SlotConflictError,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
} from '../ports.js';

/** Bounded retries after concurrent conflicts; each one re-plans on fresh data. */
const MAX_ATTEMPTS = 4;

export interface PlacementRequest {
  readonly clientId: string;
  readonly source: BookingSource;
  readonly idempotencyKey: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly start: string;
  readonly comment: string | null;
  /** Total the client confirmed; the booking never costs more. */
  readonly agreedTotal: Money;
}

export interface Placement {
  readonly id: string;
  readonly startsAt: Date;
  /** `false` when the same request booked it before. */
  readonly isNew: boolean;
  /** The time is held until the prepayment arrives. */
  readonly awaitsPayment: boolean;
}

/**
 * Places a client's booking at a free start. The engine proposes conflict-free plans;
 * the database has the final word through exclusion constraints, so a concurrent
 * booking of the same time makes this attempt fall through to the next qualified
 * staff member. A booking that asks for a prepayment holds its time until it is paid.
 * Runs inside the caller's tenant transaction.
 */
export class BookingPlacement {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly assembler: AvailabilityAssembler,
    private readonly writer: BookingWriter,
    private readonly queries: ClientBookingQueries,
    private readonly prepayments: Prepayments,
    private readonly telemetry: BookingTelemetry,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async place(context: BusinessContext, request: PlacementRequest, now: Date): Promise<Placement> {
    const repeated = await this.queries.findIdByIdempotencyKey(
      request.clientId,
      request.idempotencyKey,
    );
    if (repeated) {
      return this.existing(request.clientId, repeated);
    }
    const location = await this.catalog.findLocation(request.locationId);
    if (!location) {
      throw notFound('Location');
    }
    const start = Date.parse(request.start);
    const date = localDateOf(start, location.timeZone);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // Each attempt re-reads occupancy: after a conflict the competing booking is
      // committed and visible, so the next plan picks another staff member or resource.
      const assembled = await this.assembler.assemble({
        context,
        locationId: location.id,
        serviceIds: request.serviceIds,
        staffId: request.staffId,
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
      const option = withinAgreedPrice(priced, request.agreedTotal)[0];
      if (!option) {
        throw new ApplicationError('price_changed', 'The price of this time has changed', {
          range: priceRange(priced.map((candidate) => candidate.total)),
        });
      }
      const deposit = depositOf(option, assembled.services, context.rules);
      const awaitsPayment = deposit.amountMinor > 0;
      const id = this.ids.next();
      try {
        await this.writer.insert({
          id,
          locationId: request.locationId,
          clientId: request.clientId,
          staffId: option.plan.staffId,
          status: awaitsPayment ? 'held' : initialBookingStatus,
          hold: awaitsPayment
            ? {
                reason: 'payment',
                expiresAt: new Date(holdExpiry('payment', context.rules, now.getTime())),
              }
            : null,
          depositMinor: deposit.amountMinor,
          source: request.source,
          startsAt: new Date(option.plan.start),
          endsAt: new Date(option.plan.end),
          totalPriceMinor: option.total.amountMinor,
          currency: context.business.currency,
          comment: request.comment,
          idempotencyKey: request.idempotencyKey,
          createdAt: now,
          items: bookingItemsOf(option, assembled.services, this.ids),
        });
      } catch (error) {
        if (error instanceof DuplicateRequestError) {
          const existing = await this.queries.findIdByIdempotencyKey(
            request.clientId,
            request.idempotencyKey,
          );
          if (existing) {
            return this.existing(request.clientId, existing);
          }
        }
        if (!(error instanceof SlotConflictError)) {
          throw error;
        }
        this.telemetry.slotConflict();
        continue;
      }
      this.telemetry.bookingCreated(request.source);
      if (awaitsPayment) {
        await this.prepayments.open({
          bookingId: id,
          clientId: request.clientId,
          amount: deposit,
          now,
        });
      }
      return { id, startsAt: new Date(option.plan.start), isNew: true, awaitsPayment };
    }
    throw new ApplicationError('slot_unavailable', 'The chosen time is no longer available');
  }

  private async existing(clientId: string, bookingId: string): Promise<Placement> {
    const view = await this.queries.get(clientId, bookingId);
    if (!view) {
      throw new Error(`Booking ${bookingId} vanished inside its transaction`);
    }
    return {
      id: view.id,
      startsAt: view.startsAt,
      isNew: false,
      awaitsPayment: view.hold !== null && holdReasons[view.hold.reason].awaitsPayment,
    };
  }
}

import type {
  CabinetBookingDetails,
  DeskClient,
  VisitSettlementOptions,
} from '@mestechko/contracts';
import {
  businessBookingActions,
  explainUnavailable,
  frontDeskRules,
  localDateOf,
  planBookingOptions,
  refundsDeposit,
  type BusinessBookingAction,
  type Clock,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { BusinessAccess } from '../../../../shared/application/business-access.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { CatalogReader } from '../../../catalog/application/catalog-reader.js';
import type { ClientDirectory, ClientRecord } from '../../../clients/application/ports.js';
import type { VisitSettlements } from '../../../loyalty/application/visit-settlements.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { pricePlans, type PricedPlan } from '../availability/plan-pricing.js';
import { bookingItemsOf } from '../booking-items.js';
import type { BookingCancellation } from '../lifecycle/booking-cancellation.js';
import type { BookingNotifier } from '../lifecycle/booking-notifier.js';
import type { BookingLifecycleStore, LockedBooking } from '../lifecycle/ports.js';
import {
  DuplicateRequestError,
  SlotConflictError,
  type BookingFollowUps,
  type BookingTelemetry,
  type BookingWriter,
  type ClientBookingQueries,
  type CommittedBookingChange,
} from '../ports.js';
import type { CabinetBookings } from './cabinet-bookings.js';
import { staffFilterOf } from './staff-scope.js';

export interface DeskBookingInput {
  readonly locationId: string;
  readonly staffId: string;
  readonly serviceIds: readonly string[];
  readonly start: string;
  readonly client: DeskClient;
  readonly comment: string | null;
  readonly idempotencyKey: string;
}

/** Who acts at the front desk. */
export interface DeskActor {
  readonly access: BusinessAccess;
  readonly userId: string;
}

type Followed = Omit<CommittedBookingChange, 'businessId'>;

/**
 * Bookings the business makes and changes itself: the same engine and database guards
 * as client bookings, without the limits meant for online clients. Each change names
 * the version it was made against; the client is told through the usual messages.
 */
export class BusinessBookingChanges {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly store: BookingLifecycleStore,
    private readonly writer: BookingWriter,
    private readonly catalog: CatalogReader,
    private readonly assembler: AvailabilityAssembler,
    private readonly clients: ClientDirectory,
    private readonly queries: ClientBookingQueries,
    private readonly notifier: BookingNotifier,
    private readonly cancellation: BookingCancellation,
    private readonly prepayments: Prepayments,
    private readonly settlements: VisitSettlements,
    private readonly bookings: CabinetBookings,
    private readonly followUps: BookingFollowUps,
    private readonly telemetry: BookingTelemetry,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(actor: DeskActor, input: DeskBookingInput): Promise<CabinetBookingDetails> {
    this.assertOwnStaff(actor.access, input.staffId);
    return this.run(actor, async (context, now) => {
      const client = await this.clientOf(input.client, now);
      const repeated = await this.queries.findIdByIdempotencyKey(client.id, input.idempotencyKey);
      if (repeated) {
        return { bookingId: repeated, change: { freedTime: null } };
      }
      const option = await this.plan(context, {
        locationId: input.locationId,
        serviceIds: input.serviceIds,
        staffId: input.staffId,
        start: Date.parse(input.start),
        excludeBookingId: null,
      });
      const id = this.ids.next();
      try {
        await this.writer.insert({
          id,
          locationId: input.locationId,
          clientId: client.id,
          staffId: option.priced.plan.staffId,
          status: 'confirmed',
          hold: null,
          depositMinor: 0,
          source: 'cabinet',
          startsAt: new Date(option.priced.plan.start),
          endsAt: new Date(option.priced.plan.end),
          totalPriceMinor: option.priced.total.amountMinor,
          currency: context.business.currency,
          comment: input.comment,
          idempotencyKey: input.idempotencyKey,
          createdAt: now,
          items: bookingItemsOf(option.priced, option.services, this.ids),
        });
      } catch (error) {
        if (error instanceof DuplicateRequestError) {
          const existing = await this.queries.findIdByIdempotencyKey(
            client.id,
            input.idempotencyKey,
          );
          if (existing) {
            return { bookingId: existing, change: { freedTime: null } };
          }
        }
        throw this.conflictOf(error);
      }
      this.telemetry.bookingCreated('cabinet');
      await this.notifier.plan({
        businessId: context.business.id,
        booking: {
          id,
          version: 1,
          startsAt: new Date(option.priced.plan.start),
          source: 'cabinet',
          customerId: client.customerId,
        },
        event: 'created',
        seenByClient: false,
        now,
      });
      return { bookingId: id, change: { freedTime: null } };
    });
  }

  /** Moves a booking to another time or staff member; the agreed price stays. */
  move(
    actor: DeskActor,
    bookingId: string,
    input: { readonly staffId: string; readonly start: string; readonly expectedVersion: number },
  ): Promise<CabinetBookingDetails> {
    this.assertOwnStaff(actor.access, input.staffId);
    return this.change(
      actor,
      bookingId,
      input.expectedVersion,
      'move',
      async (context, booking, now) => {
        const start = Date.parse(input.start);
        if (start === booking.startsAt.getTime() && input.staffId === booking.staffId) {
          return { freedTime: null };
        }
        const option = await this.plan(context, {
          locationId: booking.locationId,
          serviceIds: booking.serviceIds,
          staffId: input.staffId,
          start,
          excludeBookingId: booking.id,
        });
        const agreed = booking.itemPrices;
        try {
          await this.store.move(
            booking,
            {
              staffId: input.staffId,
              startsAt: new Date(option.priced.plan.start),
              endsAt: new Date(option.priced.plan.end),
              totalPriceMinor: booking.totalPriceMinor,
              items: bookingItemsOf(option.priced, option.services, this.ids).map(
                (item, position) => ({ ...item, priceMinor: agreed[position] ?? item.priceMinor }),
              ),
            },
            now,
          );
        } catch (error) {
          throw this.conflictOf(error);
        }
        await this.store.recordEvent({
          id: this.ids.next(),
          bookingId: booking.id,
          kind: 'rescheduled',
          actor: 'business',
          channel: null,
          previousStartsAt: booking.startsAt,
          previousStaffId: input.staffId === booking.staffId ? null : booking.staffId,
          actorUserId: actor.userId,
          occurredAt: now,
        });
        await this.notify(context, booking, 'rescheduled', new Date(option.priced.plan.start), now);
        return { freedTime: this.dayOf(booking) };
      },
    );
  }

  cancel(actor: DeskActor, bookingId: string, expectedVersion: number) {
    return this.change(
      actor,
      bookingId,
      expectedVersion,
      'cancel',
      async (context, booking, now) => {
        const outcome = await this.cancellation.cancel(booking, {
          businessId: context.business.id,
          actor: 'business',
          channel: null,
          actorUserId: actor.userId,
          refundsDeposit: refundsDeposit('business', 'allowed'),
          seenByClient: false,
          now,
        });
        return {
          freedTime: outcome.freedTime,
          refunds: outcome.refundPaymentId ? [outcome.refundPaymentId] : [],
        };
      },
    );
  }

  /** Marks the visit done and settles it from a pass, points and the money due. */
  complete(
    actor: DeskActor,
    bookingId: string,
    input: {
      readonly expectedVersion: number;
      readonly passId: string | null;
      readonly points: number;
    },
  ) {
    return this.change(
      actor,
      bookingId,
      input.expectedVersion,
      'complete',
      async (context, booking, now) => {
        await this.store.setStatus(booking, 'completed', now);
        await this.record(booking, 'completed', actor, now);
        const settlement = await this.settlements.settle(
          await this.visitOf(context, booking),
          { passId: input.passId, pointsRequested: input.points },
          { userId: actor.userId, now },
        );
        const refund =
          settlement.prepaymentRefundMinor > 0
            ? await this.prepayments.requestRefund(
                booking.id,
                settlement.prepaymentRefundMinor,
                now,
              )
            : null;
        await this.notify(context, booking, 'completed', booking.startsAt, now);
        return { freedTime: null, refunds: refund ? [refund] : [] };
      },
    );
  }

  /** The client did not come: the visit stays on record and a prepayment is kept. */
  markNoShow(actor: DeskActor, bookingId: string, expectedVersion: number) {
    return this.change(
      actor,
      bookingId,
      expectedVersion,
      'no_show',
      async (context, booking, now) => {
        await this.store.setStatus(booking, 'no_show', now);
        await this.record(booking, 'no_show', actor, now);
        await this.notify(context, booking, 'no_show', booking.startsAt, now);
        return { freedTime: null };
      },
    );
  }

  async settlementOptions(actor: DeskActor, bookingId: string): Promise<VisitSettlementOptions> {
    const context = await this.businesses.byId(actor.access.businessId);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const booking = await this.lockOwn(actor.access, bookingId);
        const visit = await this.visitOf(context, booking);
        const options = await this.settlements.options(visit);
        const money = (amountMinor: number) => ({ amountMinor, currency: booking.currency });
        return {
          total: money(visit.totalMinor),
          prepaid: money(visit.prepaidMinor),
          pointsBalance: options.pointsBalance,
          pointsRedeemable: options.pointsRedeemable,
          passes: options.passes.map((pass) => ({
            id: pass.id,
            name: pass.name,
            visitsLeft: pass.visitsLeft,
            validUntil: pass.validUntil.toString(),
          })),
        };
      },
      // The booking is read under its row lock, as the visit is about to be settled.
    );
  }

  private async change(
    actor: DeskActor,
    bookingId: string,
    expectedVersion: number,
    action: BusinessBookingAction,
    apply: (context: BusinessContext, booking: LockedBooking, now: Date) => Promise<Followed>,
  ): Promise<CabinetBookingDetails> {
    return this.run(actor, async (context, now) => {
      const booking = await this.lockOwn(actor.access, bookingId);
      if (booking.version !== expectedVersion) {
        throw new ApplicationError('booking_changed', 'The booking changed meanwhile', {
          version: booking.version,
        });
      }
      const state = { status: booking.status, startsAt: booking.startsAt.getTime() };
      if (!businessBookingActions[action].isAvailable(state, now.getTime())) {
        throw new ApplicationError('change_not_allowed', 'Not possible for this booking now', {
          reason: action,
        });
      }
      return { bookingId, change: await apply(context, booking, now) };
    });
  }

  /** One tenant transaction, then the follow-ups and the booking as it now is. */
  private async run(
    actor: DeskActor,
    work: (
      context: BusinessContext,
      now: Date,
    ) => Promise<{ readonly bookingId: string; readonly change: Followed }>,
  ): Promise<CabinetBookingDetails> {
    const context = await this.businesses.byId(actor.access.businessId);
    const businessId = context.business.id;
    const outcome = await this.unitOfWork.inTenant(businessId, () =>
      work(context, new Date(this.clock.now().epochMilliseconds)),
    );
    await this.followUps.afterCommit({ businessId, ...outcome.change });
    return this.bookings.details(actor.access, outcome.bookingId);
  }

  /**
   * The plan for the staff member at the start, by the front desk's rules; when there
   * is none, the error says why (outside working hours, busy, no free chair...).
   */
  private async plan(
    context: BusinessContext,
    request: {
      readonly locationId: string;
      readonly serviceIds: readonly string[];
      readonly staffId: string;
      readonly start: number;
      readonly excludeBookingId: string | null;
    },
  ) {
    const timeZone = await this.locationTimeZone(context, request);
    const date = localDateOf(request.start, timeZone);
    const assembled = await this.assembler.assemble({
      context,
      locationId: request.locationId,
      serviceIds: request.serviceIds,
      staffId: request.staffId,
      from: date,
      to: date,
      now: this.clock.now(),
      rules: frontDeskRules(context.rules),
      ...(request.excludeBookingId ? { excludeBookingId: request.excludeBookingId } : {}),
    });
    const priced: PricedPlan | undefined = pricePlans(
      planBookingOptions(assembled.request, request.start),
      assembled,
      context.business.currency,
    )[0];
    if (!priced) {
      throw new ApplicationError('slot_unavailable', 'The staff member is not free then', {
        reason:
          explainUnavailable(assembled.request, request.staffId, request.start) ?? 'staff_busy',
      });
    }
    return { priced, services: assembled.services };
  }

  private async locationTimeZone(
    _context: BusinessContext,
    request: { readonly locationId: string },
  ): Promise<string> {
    const location = await this.catalog.findLocation(request.locationId);
    if (!location) {
      throw notFound('Location');
    }
    return location.timeZone;
  }

  private conflictOf(error: unknown): unknown {
    if (error instanceof SlotConflictError) {
      this.telemetry.slotConflict();
      return new ApplicationError('slot_unavailable', 'The time was taken meanwhile', {
        reason: 'staff_busy',
      });
    }
    return error;
  }

  private async clientOf(client: DeskClient, now: Date): Promise<ClientRecord> {
    if (client.kind === 'existing') {
      const existing = await this.clients.findById(client.clientId);
      if (!existing) {
        throw notFound('Client');
      }
      return existing;
    }
    const known = client.phone ? await this.clients.findByPhone(client.phone) : null;
    return (
      known ??
      this.clients.create({
        id: this.ids.next(),
        displayName: client.name,
        phone: client.phone,
        email: null,
        tags: [],
        now,
      })
    );
  }

  private async lockOwn(access: BusinessAccess, bookingId: string): Promise<LockedBooking> {
    const booking = await this.store.lock(bookingId);
    const ownStaffId = staffFilterOf(access);
    if (!booking || (ownStaffId !== null && booking.staffId !== ownStaffId)) {
      throw notFound('Booking');
    }
    return booking;
  }

  private assertOwnStaff(access: BusinessAccess, staffId: string): void {
    const ownStaffId = staffFilterOf(access);
    if (ownStaffId !== null && ownStaffId !== staffId) {
      throw new ApplicationError('forbidden', 'Only your own schedule');
    }
  }

  private async visitOf(context: BusinessContext, booking: LockedBooking) {
    return {
      clientId: booking.clientId,
      bookingId: booking.id,
      serviceIds: booking.serviceIds,
      totalMinor: booking.totalPriceMinor,
      prepaidMinor: await this.prepayments.keptFor(booking.id),
      currency: context.business.currency,
      date: localDateOf(booking.startsAt.getTime(), booking.timeZone),
    };
  }

  private async record(
    booking: LockedBooking,
    kind: 'completed' | 'no_show',
    actor: DeskActor,
    now: Date,
  ): Promise<void> {
    await this.store.recordEvent({
      id: this.ids.next(),
      bookingId: booking.id,
      kind,
      actor: 'business',
      channel: null,
      previousStartsAt: null,
      previousStaffId: null,
      actorUserId: actor.userId,
      occurredAt: now,
    });
  }

  private async notify(
    context: BusinessContext,
    booking: LockedBooking,
    event: 'rescheduled' | 'completed' | 'no_show',
    startsAt: Date,
    now: Date,
  ): Promise<void> {
    await this.notifier.plan({
      businessId: context.business.id,
      booking: {
        id: booking.id,
        version: booking.version + 1,
        startsAt,
        source: booking.source,
        customerId: booking.customerId,
      },
      event,
      seenByClient: false,
      now,
    });
  }

  private dayOf(booking: LockedBooking): CommittedBookingChange['freedTime'] {
    return {
      locationId: booking.locationId,
      date: localDateOf(booking.startsAt.getTime(), booking.timeZone).toString(),
    };
  }
}

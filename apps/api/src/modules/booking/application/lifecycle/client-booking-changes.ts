import type { ClientBooking } from '@mestechko/contracts';
import {
  canConfirmAttendance,
  clientChangeDeadline,
  clientChangeVerdict,
  localDateOf,
  planBookingOptions,
  priceRange,
  withinAgreedPrice,
  type BookingLifecycleEvent,
  type Clock,
  type MessengerChannel,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { IdGenerator } from '../../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { ClientDirectory, CustomerIdentities } from '../../../clients/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { pricePlans } from '../availability/plan-pricing.js';
import { bookingItemsOf } from '../booking-items.js';
import type { ClientIdentity } from '../client/client-bookings.js';
import { toClientBooking } from '../client/client-booking-view.js';
import {
  SlotConflictError,
  type BookingFollowUps,
  type ClientBookingQueries,
  type CommittedBookingChange,
} from '../ports.js';
import type { BookingNotifier } from './booking-notifier.js';
import type { BookingLifecycleStore, LockedBooking } from './ports.js';

/**
 * Where the client acted. In a chat the edited message already shows the outcome, so
 * no separate notice follows; in the web app the chat gets one.
 */
export interface ChangeOrigin {
  readonly channel: MessengerChannel;
  readonly surface: 'web_app' | 'chat';
}

/** Bounded retries after concurrent conflicts; each one re-plans on fresh data. */
const MAX_ATTEMPTS = 4;

interface ChangeOutcome {
  readonly clientId: string;
  readonly freedTime: CommittedBookingChange['freedTime'];
}

/** Reschedule, cancel and attendance by the client, under the business's change rules. */
export class ClientBookingChanges {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly store: BookingLifecycleStore,
    private readonly assembler: AvailabilityAssembler,
    private readonly queries: ClientBookingQueries,
    private readonly notifier: BookingNotifier,
    private readonly followUps: BookingFollowUps,
    private readonly avatars: AvatarUrls,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  cancel(identity: ClientIdentity, bookingId: string, origin: ChangeOrigin) {
    return this.change(identity, bookingId, async (context, booking, now) => {
      this.assertChangeOpen(context, booking, now);
      await this.store.cancel(booking, now);
      await this.record(booking, 'cancelled', origin, null, now);
      await this.notify(
        context,
        booking,
        booking.version + 1,
        booking.startsAt,
        'cancelled',
        origin,
        now,
      );
      return this.freed(booking);
    });
  }

  reschedule(identity: ClientIdentity, bookingId: string, start: string, origin: ChangeOrigin) {
    return this.change(identity, bookingId, async (context, booking, now) => {
      this.assertChangeOpen(context, booking, now);
      const startsAt = Date.parse(start);
      if (startsAt === booking.startsAt.getTime()) {
        return null;
      }
      const moved = await this.move(context, booking, startsAt, now);
      await this.record(booking, 'rescheduled', origin, booking.startsAt, now);
      await this.notify(context, booking, booking.version + 1, moved, 'rescheduled', origin, now);
      return this.freed(booking);
    });
  }

  confirmAttendance(identity: ClientIdentity, bookingId: string, origin: ChangeOrigin) {
    return this.change(identity, bookingId, async (_context, booking, now) => {
      const state = {
        status: booking.status,
        startsAt: booking.startsAt.getTime(),
        attendanceConfirmedAt: booking.attendanceConfirmedAt?.getTime() ?? null,
      };
      if (!canConfirmAttendance(state, now.getTime())) {
        if (booking.attendanceConfirmedAt) {
          return null;
        }
        throw new ApplicationError('change_not_allowed', 'The visit can no longer be confirmed');
      }
      await this.store.confirmAttendance(booking, now);
      await this.record(booking, 'attendance_confirmed', origin, null, now);
      return null;
    });
  }

  /** Locks the client's own booking, applies the change and reports the result. */
  private async change(
    identity: ClientIdentity,
    bookingId: string,
    apply: (
      context: BusinessContext,
      booking: LockedBooking,
      now: Date,
    ) => Promise<ChangeOutcome['freedTime']>,
  ): Promise<ClientBooking> {
    const context = await this.businesses.resolve(identity.business);
    const businessId = context.business.id;
    const outcome = await this.unitOfWork.inTenant(businessId, async (): Promise<ChangeOutcome> => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const customerId = await this.customers.find(identity.channel, identity.externalUserId);
      const client = customerId ? await this.clients.findByCustomer(customerId) : null;
      const booking = await this.store.lock(bookingId);
      if (!client || booking?.clientId !== client.id) {
        throw notFound('Booking');
      }
      return { clientId: client.id, freedTime: await apply(context, booking, now) };
    });
    await this.followUps.afterCommit({ businessId, freedTime: outcome.freedTime });
    const view = await this.unitOfWork.inTenant(
      businessId,
      () => this.queries.get(outcome.clientId, bookingId),
      { readOnly: true },
    );
    if (!view) {
      throw notFound('Booking');
    }
    return toClientBooking(
      view,
      this.avatars,
      context.rules.clientChanges,
      this.clock.now().epochMilliseconds,
    );
  }

  private assertChangeOpen(context: BusinessContext, booking: LockedBooking, now: Date): void {
    const rule = context.rules.clientChanges;
    const state = {
      status: booking.status,
      startsAt: booking.startsAt.getTime(),
      attendanceConfirmedAt: booking.attendanceConfirmedAt?.getTime() ?? null,
    };
    const verdict = clientChangeVerdict(state, now.getTime(), rule);
    if (verdict !== 'allowed') {
      throw new ApplicationError(
        'change_not_allowed',
        'Online changes are closed for this booking',
        {
          reason: verdict,
          deadline: new Date(clientChangeDeadline(state.startsAt, rule)).toISOString(),
        },
      );
    }
  }

  /**
   * Re-plans the same services with the same staff member at the new start. The
   * booking's own time does not block it, and the total never grows.
   */
  private async move(
    context: BusinessContext,
    booking: LockedBooking,
    startsAt: number,
    now: Date,
  ): Promise<Date> {
    const date = localDateOf(startsAt, booking.timeZone);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const assembled = await this.assembler.assemble({
        context,
        locationId: booking.locationId,
        serviceIds: booking.serviceIds,
        staffId: booking.staffId,
        from: date,
        to: date,
        now: this.clock.now(),
        excludeBookingId: booking.id,
      });
      const priced = pricePlans(
        planBookingOptions(assembled.request, startsAt),
        assembled,
        context.business.currency,
      );
      if (priced.length === 0) {
        break;
      }
      const option = withinAgreedPrice(priced, {
        amountMinor: booking.totalPriceMinor,
        currency: booking.currency,
      })[0];
      if (!option) {
        throw new ApplicationError('price_changed', 'The new time costs more than the booking', {
          range: priceRange(priced.map((candidate) => candidate.total)),
        });
      }
      try {
        await this.store.move(
          booking,
          {
            startsAt: new Date(option.plan.start),
            endsAt: new Date(option.plan.end),
            totalPriceMinor: option.total.amountMinor,
            items: bookingItemsOf(option, assembled.services, this.ids),
          },
          now,
        );
        return new Date(option.plan.start);
      } catch (error) {
        if (!(error instanceof SlotConflictError)) {
          throw error;
        }
      }
    }
    throw new ApplicationError('slot_unavailable', 'The chosen time is no longer available');
  }

  private async record(
    booking: LockedBooking,
    kind: 'cancelled' | 'rescheduled' | 'attendance_confirmed',
    origin: ChangeOrigin,
    previousStartsAt: Date | null,
    now: Date,
  ): Promise<void> {
    await this.store.recordEvent({
      id: this.ids.next(),
      bookingId: booking.id,
      kind,
      actor: 'client',
      channel: origin.channel,
      previousStartsAt,
      occurredAt: now,
    });
  }

  private async notify(
    context: BusinessContext,
    booking: LockedBooking,
    version: number,
    startsAt: Date,
    event: BookingLifecycleEvent,
    origin: ChangeOrigin,
    now: Date,
  ): Promise<void> {
    await this.notifier.plan({
      businessId: context.business.id,
      booking: {
        id: booking.id,
        version,
        startsAt,
        source: booking.source,
        customerId: booking.customerId,
      },
      event,
      seenByClient: origin.surface === 'chat',
      now,
    });
  }

  private freed(booking: LockedBooking): ChangeOutcome['freedTime'] {
    return {
      locationId: booking.locationId,
      date: localDateOf(booking.startsAt.getTime(), booking.timeZone).toString(),
    };
  }
}

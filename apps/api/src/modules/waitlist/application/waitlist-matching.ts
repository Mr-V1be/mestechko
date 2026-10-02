import {
  findAvailability,
  firstStartInWindow,
  holdExpiry,
  localMinuteOf,
  messengerBookingSource,
  planBookingOptions,
  Temporal,
  type Clock,
} from '@mestechko/domain';
import { z } from 'zod';
import { defineJob, type JobHandler } from '../../../shared/application/job-queue.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { AvailabilityAssembler } from '../../booking/application/availability/availability-assembler.js';
import { depositOf, pricePlans } from '../../booking/application/availability/plan-pricing.js';
import { bookingItemsOf } from '../../booking/application/booking-items.js';
import type { BookingLifecycleStore } from '../../booking/application/lifecycle/ports.js';
import { SlotConflictError, type BookingWriter } from '../../booking/application/ports.js';
import type { NotificationOutbox } from '../../notifications/application/ports.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../tenancy/application/business-context.js';
import type { WaitlistEntryRecord, WaitlistStore } from './ports.js';

const MATCH_HANDLER = Symbol('WAITLIST_MATCH_HANDLER');
const SECOND_MS = 1_000;

export const matchWaitlistJob = defineJob({
  name: 'waitlist-match',
  payload: z.object({
    businessId: z.uuid(),
    locationId: z.uuid(),
    date: z.iso.date(),
  }),
  attempts: 3,
  backoffMs: 10 * SECOND_MS,
  concurrency: 2,
  handler: MATCH_HANDLER,
});

export const waitlistHandlerTokens = { match: MATCH_HANDLER };

/** Changes freeing the same day collapse into one pending match. */
export function matchDeduplicationKey(payload: z.infer<typeof matchWaitlistJob.payload>): string {
  return `waitlist-${payload.businessId}-${payload.locationId}-${payload.date}`;
}

/** Whether the run made offers whose messages are due now. */
export interface MatchResult {
  readonly offered: number;
}

/**
 * Offers freed time to those waiting for that day, one client at a time: the client
 * who waited longest gets the earliest free start in their part of the day, held for
 * them by a booking for a while. When they decline or the hold runs out, the time
 * frees up again and goes to the next in line; it is never offered to them twice.
 */
export class MatchWaitlist implements JobHandler<z.infer<typeof matchWaitlistJob.payload>> {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly store: WaitlistStore,
    private readonly assembler: AvailabilityAssembler,
    private readonly writer: BookingWriter,
    private readonly lifecycle: BookingLifecycleStore,
    private readonly outbox: NotificationOutbox,
    private readonly onOffered: () => Promise<void>,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async handle(payload: z.infer<typeof matchWaitlistJob.payload>): Promise<void> {
    const result = await this.match(payload);
    if (result.offered > 0) {
      await this.onOffered();
    }
  }

  async match(payload: z.infer<typeof matchWaitlistJob.payload>): Promise<MatchResult> {
    const context = await this.businesses.byId(payload.businessId);
    return this.unitOfWork.inTenant(context.business.id, async () => {
      const now = new Date(this.clock.now().epochMilliseconds);
      const waiting = await this.settleOffers(payload.locationId, payload.date, now);
      const entries = (await this.store.listOpenForDay(payload.locationId, payload.date)).filter(
        (entry) => !waiting.has(entry.id),
      );
      const offered = await this.store.offeredStarts(entries.map((entry) => entry.id));
      let made = 0;
      for (const entry of entries) {
        if (await this.offer(context, entry, offered.get(entry.id) ?? new Set(), now)) {
          made += 1;
        }
      }
      return { offered: made };
    });
  }

  /**
   * Closes offers whose hold ended (it ran out or was released) and returns the
   * entries still waiting for an answer.
   */
  private async settleOffers(locationId: string, date: string, now: Date): Promise<Set<string>> {
    const waiting = new Set<string>();
    for (const offer of await this.store.pendingOffers(locationId, date)) {
      const booking = await this.lifecycle.lock(offer.bookingId);
      if (booking?.hold) {
        waiting.add(offer.entryId);
      } else {
        await this.store.closeOffer(offer.id, 'expired', now);
      }
    }
    return waiting;
  }

  private async offer(
    context: BusinessContext,
    entry: WaitlistEntryRecord,
    offeredBefore: ReadonlySet<number>,
    now: Date,
  ): Promise<boolean> {
    if (!entry.customerId) {
      return false;
    }
    const date = Temporal.PlainDate.from(entry.date);
    const assembled = await this.assembler.assemble({
      context,
      locationId: entry.locationId,
      serviceIds: entry.serviceIds,
      staffId: entry.staffId,
      from: date,
      to: date,
      now: this.clock.now(),
    });
    const timeZone = assembled.location.timeZone;
    const starts = findAvailability(assembled.request).flatMap((day) =>
      day.slots.map((slot) => slot.start),
    );
    const start = firstStartInWindow(
      starts,
      entry.window,
      (epoch) => localMinuteOf(epoch, timeZone),
      offeredBefore,
    );
    if (start === null) {
      return false;
    }
    const option = pricePlans(
      planBookingOptions(assembled.request, start),
      assembled,
      context.business.currency,
    ).sort((a, b) => a.total.amountMinor - b.total.amountMinor)[0];
    if (!option) {
      return false;
    }
    const bookingId = this.ids.next();
    try {
      await this.writer.insert({
        id: bookingId,
        locationId: entry.locationId,
        clientId: entry.clientId,
        staffId: option.plan.staffId,
        status: 'held',
        hold: {
          reason: 'waitlist_offer',
          expiresAt: new Date(holdExpiry('waitlist_offer', context.rules, now.getTime())),
        },
        depositMinor: depositOf(option, assembled.services, context.rules).amountMinor,
        source: messengerBookingSource(entry.channel, 'chat'),
        startsAt: new Date(option.plan.start),
        endsAt: new Date(option.plan.end),
        totalPriceMinor: option.total.amountMinor,
        currency: context.business.currency,
        comment: null,
        idempotencyKey: null,
        createdAt: now,
        items: bookingItemsOf(option, assembled.services, this.ids),
      });
    } catch (error) {
      if (error instanceof SlotConflictError) {
        return false;
      }
      throw error;
    }
    await this.store.insertOffer(
      { id: this.ids.next(), entryId: entry.id, bookingId, startsAt: new Date(start) },
      now,
    );
    return this.outbox.offerWaitlistSlot({
      businessId: context.business.id,
      entryId: entry.id,
      recipient: { customerId: entry.customerId, channel: entry.channel },
      startsAt: new Date(start),
      totalMinor: option.total.amountMinor,
      now,
    });
  }
}

import {
  findAvailability,
  firstStartInWindow,
  localMinuteOf,
  planBookingOptions,
  Temporal,
  type Clock,
} from '@mestechko/domain';
import { z } from 'zod';
import { defineJob, type JobHandler } from '../../../shared/application/job-queue.js';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.js';
import type { AvailabilityAssembler } from '../../booking/application/availability/availability-assembler.js';
import { pricePlans } from '../../booking/application/availability/plan-pricing.js';
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

/** Whether the run planned offers that are due now. */
export interface MatchResult {
  readonly offered: number;
}

/**
 * Offers freed time to those waiting for that day: each open wish gets the earliest
 * free start in its part of the day, at the price it would cost. Whoever accepts
 * first books it; the others hear it is taken.
 */
export class MatchWaitlist implements JobHandler<z.infer<typeof matchWaitlistJob.payload>> {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly store: WaitlistStore,
    private readonly assembler: AvailabilityAssembler,
    private readonly outbox: NotificationOutbox,
    private readonly onOffered: () => Promise<void>,
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
      const entries = await this.store.listOpenForDay(payload.locationId, payload.date);
      let offered = 0;
      for (const entry of entries) {
        if (await this.offer(context, entry)) {
          offered += 1;
        }
      }
      return { offered };
    });
  }

  private async offer(context: BusinessContext, entry: WaitlistEntryRecord): Promise<boolean> {
    if (!entry.customerId) {
      return false;
    }
    const date = Temporal.PlainDate.from(entry.date);
    const now = this.clock.now();
    const assembled = await this.assembler.assemble({
      context,
      locationId: entry.locationId,
      serviceIds: entry.serviceIds,
      staffId: entry.staffId,
      from: date,
      to: date,
      now,
    });
    const timeZone = assembled.location.timeZone;
    const starts = findAvailability(assembled.request).flatMap((day) =>
      day.slots.map((slot) => slot.start),
    );
    const start = firstStartInWindow(starts, entry.window, (epoch) =>
      localMinuteOf(epoch, timeZone),
    );
    if (start === null) {
      return false;
    }
    const totals = pricePlans(
      planBookingOptions(assembled.request, start),
      assembled,
      context.business.currency,
    ).map((option) => option.total.amountMinor);
    if (totals.length === 0) {
      return false;
    }
    return this.outbox.offerWaitlistSlot({
      businessId: context.business.id,
      entryId: entry.id,
      recipient: { customerId: entry.customerId, channel: entry.channel },
      startsAt: new Date(start),
      totalMinor: Math.min(...totals),
      now: new Date(now.epochMilliseconds),
    });
  }
}

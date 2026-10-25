import type { Clock } from '@mestechko/domain';
import { z } from 'zod';
import {
  defineJob,
  type JobHandler,
  type JobQueue,
} from '../../../shared/application/job-queue.js';
import type { BusinessDirectory } from '../../tenancy/application/business-directory.js';
import type { ProductionCalendarSource, ProductionCalendarStore } from './ports.js';

const SYNC_HANDLER = Symbol('PRODUCTION_CALENDAR_SYNC_HANDLER');
const REFRESH_HANDLER = Symbol('PRODUCTION_CALENDAR_REFRESH_HANDLER');
const MINUTE_MS = 60_000;

export const productionCalendarSyncJob = defineJob({
  name: 'production-calendar-sync',
  payload: z.object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    year: z.number().int().min(2000).max(2100),
  }),
  attempts: 6,
  backoffMs: MINUTE_MS,
  concurrency: 1,
  handler: SYNC_HANDLER,
});

/** Daily: re-syncs the current and next year for every country businesses operate in. */
export const productionCalendarRefreshJob = defineJob({
  name: 'production-calendar-refresh',
  payload: z.object({}),
  attempts: 3,
  backoffMs: MINUTE_MS,
  concurrency: 1,
  handler: REFRESH_HANDLER,
  /** Daily at 03:00 UTC, before the business day in Russia. */
  every: '0 3 * * *',
});

export const productionCalendarHandlerTokens = { sync: SYNC_HANDLER, refresh: REFRESH_HANDLER };

/** Repeated requests for the same country and year collapse into one pending job. */
export function syncDeduplicationKey(countryCode: string, year: number): string {
  return `calendar-${countryCode}-${String(year)}`;
}

export class SyncProductionCalendar implements JobHandler<
  z.infer<typeof productionCalendarSyncJob.payload>
> {
  constructor(
    private readonly source: ProductionCalendarSource,
    private readonly store: ProductionCalendarStore,
    private readonly clock: Clock,
  ) {}

  async handle(payload: { countryCode: string; year: number }): Promise<void> {
    const year = await this.source.fetchYear(payload.countryCode, payload.year);
    await this.store.save(
      payload.countryCode,
      year,
      this.source.name,
      new Date(this.clock.now().epochMilliseconds),
    );
  }
}

export class RefreshProductionCalendars implements JobHandler<Record<string, never>> {
  constructor(
    private readonly businesses: BusinessDirectory,
    private readonly source: Pick<ProductionCalendarSource, 'covers'>,
    private readonly queue: JobQueue,
    private readonly clock: Clock,
  ) {}

  async handle(): Promise<void> {
    const currentYear = Number(this.clock.now().toString().slice(0, 4));
    const countries = await this.businesses.listCountryCodes();
    for (const countryCode of countries.filter((country) => this.source.covers(country))) {
      for (const year of [currentYear, currentYear + 1]) {
        await this.queue.enqueue(
          productionCalendarSyncJob,
          { countryCode, year },
          { deduplicationKey: syncDeduplicationKey(countryCode, year) },
        );
      }
    }
  }
}

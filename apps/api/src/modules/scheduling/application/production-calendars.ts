import { YearlyProductionCalendar, type ProductionCalendar } from '@mestechko/domain';
import type { JobQueue } from '../../../shared/application/job-queue.js';
import { productionCalendarSyncJob, syncDeduplicationKey } from './production-calendar-jobs.js';
import type { ProductionCalendarStore, WarningLogger } from './ports.js';

/**
 * Production calendars for availability. Years not synced yet are requested in the
 * background; meanwhile those days follow the staff schedule alone.
 */
export class ProductionCalendars {
  constructor(
    private readonly store: ProductionCalendarStore,
    private readonly queue: JobQueue,
    private readonly logger: WarningLogger,
  ) {}

  async calendarFor(countryCode: string, years: readonly number[]): Promise<ProductionCalendar> {
    const stored = await this.store.load(countryCode, years);
    const missing = years.filter((year) => !stored.some((entry) => entry.year === year));
    for (const year of missing) {
      this.logger.warn({ countryCode, year }, 'Production calendar is missing, requesting sync');
      await this.queue
        .enqueue(
          productionCalendarSyncJob,
          { countryCode, year },
          { deduplicationKey: syncDeduplicationKey(countryCode, year) },
        )
        .catch((error: unknown) => {
          this.logger.warn({ countryCode, year, err: error }, 'Could not request calendar sync');
        });
    }
    return new YearlyProductionCalendar(stored);
  }
}

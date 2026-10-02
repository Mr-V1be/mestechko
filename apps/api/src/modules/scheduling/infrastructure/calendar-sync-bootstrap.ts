import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue.js';
import { productionCalendarRefreshJob } from '../application/production-calendar-jobs.js';

/** Calendars are refreshed daily (see the job) and once right after a worker starts. */
@Injectable()
export class CalendarSyncBootstrap implements OnApplicationBootstrap {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CalendarSyncBootstrap.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.roles.includes('worker')) {
      return;
    }
    await this.queue.enqueue(
      productionCalendarRefreshJob,
      {},
      { deduplicationKey: 'calendar-refresh' },
    );
    this.logger.info('Production calendar refresh requested');
  }
}

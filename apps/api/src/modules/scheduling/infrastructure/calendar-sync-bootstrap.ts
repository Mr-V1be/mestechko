import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue.js';
import { productionCalendarRefreshJob } from '../application/production-calendar-jobs.js';

const DAILY_AT_03_UTC = '0 3 * * *';

/** Worker processes keep calendars fresh: a daily refresh plus one right after start. */
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
    await this.queue.schedule(
      productionCalendarRefreshJob,
      {},
      {
        schedulerId: 'production-calendar-daily',
        cron: DAILY_AT_03_UTC,
      },
    );
    await this.queue.enqueue(
      productionCalendarRefreshJob,
      {},
      { deduplicationKey: 'calendar-refresh' },
    );
    this.logger.info('Production calendar refresh scheduled');
  }
}

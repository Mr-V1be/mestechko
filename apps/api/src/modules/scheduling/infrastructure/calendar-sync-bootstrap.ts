import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { CLOCK, type Clock } from '../../../shared/application/ports.js';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue.js';
import { productionCalendarRefreshJob } from '../application/production-calendar-jobs.js';

const DAILY_AT_03_UTC = '0 3 * * *';

/** Worker processes keep calendars fresh: a daily refresh plus one right after start. */
@Injectable()
export class CalendarSyncBootstrap implements OnApplicationBootstrap {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(CLOCK) private readonly clock: Clock,
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
    const today = this.clock.now().toString().slice(0, 10);
    await this.queue.enqueue(
      productionCalendarRefreshJob,
      {},
      {
        deduplicationKey: `calendar-refresh-${today}`,
      },
    );
    this.logger.info('Production calendar refresh scheduled');
  }
}

import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { JOB_QUEUE, type JobQueue } from '../../../shared/application/job-queue.js';
import { dispatchNotificationsJob } from '../application/notification-jobs.js';

const EVERY_MINUTE = '* * * * *';

/** Worker processes sweep the outbox every minute; changes also kick it right away. */
@Injectable()
export class DispatchBootstrap implements OnApplicationBootstrap {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DispatchBootstrap.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.roles.includes('worker')) {
      return;
    }
    await this.queue.schedule(
      dispatchNotificationsJob,
      {},
      { schedulerId: 'notifications-every-minute', cron: EVERY_MINUTE },
    );
    this.logger.info('Notification dispatch scheduled');
  }
}

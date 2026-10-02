import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import {
  JOB_DEFINITIONS,
  JOB_QUEUE,
  type JobDefinition,
  type JobHandler,
  type JobQueue,
} from '../../shared/application/job-queue.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { REDIS } from '../redis/redis.js';
import { QUEUE_PREFIX } from './bullmq-job-queue.js';

/**
 * Starts BullMQ workers for every registered job when the process has the worker role,
 * and schedules the periodic ones.
 */
@Injectable()
export class JobWorkers implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS) private readonly connection: Redis,
    @Inject(JOB_DEFINITIONS) private readonly jobs: readonly JobDefinition<unknown>[],
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(JobWorkers.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.roles.includes('worker')) {
      return;
    }
    for (const job of this.jobs) {
      if (job.every) {
        await this.queue.schedule(job, {}, { schedulerId: `${job.name}-every`, cron: job.every });
      }
    }
    for (const job of this.jobs) {
      const handler = this.moduleRef.get<JobHandler<unknown>>(job.handler, { strict: false });
      const worker = new Worker(
        job.name,
        async (bullJob) => {
          await handler.handle(job.payload.parse(bullJob.data));
        },
        { connection: this.connection, prefix: QUEUE_PREFIX, concurrency: job.concurrency },
      );
      worker.on('failed', (failed, error) => {
        this.logger.error({ job: job.name, jobId: failed?.id, err: error }, 'Job failed');
      });
      this.workers.push(worker);
    }
    this.logger.info({ jobs: this.jobs.map((job) => job.name) }, 'Workers started');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}

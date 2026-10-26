import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type {
  EnqueueOptions,
  JobDefinition,
  JobQueue,
  ScheduleOptions,
} from '../../shared/application/job-queue.js';
import { SYSTEM_NAME } from '../system-name.js';

/** Queues live in the product's namespace: `slotwise:<queue>:…`. */
export const QUEUE_PREFIX = SYSTEM_NAME;
const DAY_SECONDS = 86_400;
const RETAINED_COMPLETED_JOBS = 1_000;
const FAILED_RETENTION_DAYS = 7;

export function jobOptions(job: JobDefinition<unknown>) {
  return {
    attempts: job.attempts,
    backoff: { type: 'exponential', delay: job.backoffMs },
    removeOnComplete: { age: DAY_SECONDS, count: RETAINED_COMPLETED_JOBS },
    removeOnFail: { age: DAY_SECONDS * FAILED_RETENTION_DAYS },
  } as const;
}

export class BullMqJobQueue implements JobQueue {
  private readonly queues = new Map<string, Queue>();
  private readonly connection: Redis;

  constructor(connection: Redis) {
    this.connection = connection;
  }

  private queueFor(job: JobDefinition<unknown>): Queue {
    const existing = this.queues.get(job.name);
    if (existing) {
      return existing;
    }
    const queue = new Queue(job.name, { connection: this.connection, prefix: QUEUE_PREFIX });
    this.queues.set(job.name, queue);
    return queue;
  }

  async enqueue<P>(job: JobDefinition<P>, payload: P, options: EnqueueOptions): Promise<void> {
    const generic = job as JobDefinition<unknown>;
    await this.queueFor(generic).add(job.name, job.payload.parse(payload), {
      ...jobOptions(generic),
      deduplication: { id: options.deduplicationKey },
    });
  }

  async schedule<P>(job: JobDefinition<P>, payload: P, options: ScheduleOptions): Promise<void> {
    const generic = job as JobDefinition<unknown>;
    await this.queueFor(generic).upsertJobScheduler(
      options.schedulerId,
      { pattern: options.cron, tz: 'UTC' },
      { name: job.name, data: job.payload.parse(payload), opts: jobOptions(generic) },
    );
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}

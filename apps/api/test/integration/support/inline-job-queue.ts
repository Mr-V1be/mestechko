import type { ModuleRef } from '@nestjs/core';
import type {
  EnqueueOptions,
  JobDefinition,
  JobHandler,
  JobQueue,
} from '../../../src/shared/application/job-queue.js';

interface PendingJob {
  readonly job: JobDefinition<unknown>;
  readonly payload: unknown;
}

/**
 * Test double of the queue: jobs wait until the test drains them, which runs each
 * handler in order. Scheduled (cron) jobs are recorded and never fire on their own.
 */
export class InlineJobQueue implements JobQueue {
  private readonly pending: PendingJob[] = [];
  private moduleRef: ModuleRef | null = null;

  attach(moduleRef: ModuleRef): void {
    this.moduleRef = moduleRef;
  }

  enqueue<P>(job: JobDefinition<P>, payload: P, _options: EnqueueOptions): Promise<void> {
    this.pending.push({ job, payload: job.payload.parse(payload) });
    return Promise.resolve();
  }

  schedule(): Promise<void> {
    return Promise.resolve();
  }

  /** Runs queued jobs, and the jobs they queue, until none are left. */
  async drain(): Promise<void> {
    const moduleRef = this.moduleRef;
    if (!moduleRef) {
      throw new Error('The queue is not attached to the application');
    }
    for (let next = this.pending.shift(); next; next = this.pending.shift()) {
      const handler = moduleRef.get<JobHandler<unknown>>(next.job.handler, { strict: false });
      await handler.handle(next.payload);
    }
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

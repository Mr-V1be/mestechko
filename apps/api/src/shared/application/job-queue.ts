import type { z } from 'zod';

/** A kind of background job: payload schema, retry policy and the DI token of its handler. */
export interface JobDefinition<P> {
  readonly name: string;
  readonly payload: z.ZodType<P>;
  readonly attempts: number;
  readonly backoffMs: number;
  readonly concurrency: number;
  readonly handler: symbol;
}

export interface JobHandler<P> {
  handle(payload: P): Promise<void>;
}

export interface EnqueueOptions {
  /** Requests with the same key collapse into one job while it waits or runs. */
  readonly deduplicationKey: string;
}

export interface ScheduleOptions {
  readonly schedulerId: string;
  /** Cron pattern in UTC. */
  readonly cron: string;
}

export interface JobQueue {
  enqueue<P>(job: JobDefinition<P>, payload: P, options: EnqueueOptions): Promise<void>;
  schedule<P>(job: JobDefinition<P>, payload: P, options: ScheduleOptions): Promise<void>;
}

export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const JOB_DEFINITIONS = Symbol('JOB_DEFINITIONS');

export function defineJob<P>(definition: JobDefinition<P>): JobDefinition<P> {
  return definition;
}

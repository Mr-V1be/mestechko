import { Controller, Get, Inject, Res, ServiceUnavailableException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Redis } from 'ioredis';
import { DATABASE, type Database } from '../db/database.js';
import { REDIS } from '../redis/redis.js';
import { TELEMETRY, type Telemetry } from './telemetry.js';

const PROBE_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Probe timed out'));
      }, PROBE_TIMEOUT_MS).unref();
    }),
  ]);
}

/** Liveness, readiness and metrics endpoints for the platform, outside the public contract. */
@Controller()
export class OperationsController {
  private readonly db: Kysely<Database>;
  private readonly redis: Redis;
  private readonly telemetry: Telemetry;

  constructor(
    @Inject(DATABASE) db: Kysely<Database>,
    @Inject(REDIS) redis: Redis,
    @Inject(TELEMETRY) telemetry: Telemetry,
  ) {
    this.db = db;
    this.redis = redis;
    this.telemetry = telemetry;
  }

  @Get('/health/live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('/health/ready')
  async ready(): Promise<{ status: 'ok' }> {
    try {
      await withTimeout(sql`select 1`.execute(this.db));
      await withTimeout(this.redis.ping());
    } catch {
      throw new ServiceUnavailableException('Dependencies are not ready');
    }
    return { status: 'ok' };
  }

  @Get('/metrics')
  metrics(@Res() reply: FastifyReply): void {
    const exporter = this.telemetry.prometheus;
    if (!exporter) {
      void reply.status(404).send();
      return;
    }
    reply.hijack();
    exporter.getMetricsRequestHandler(reply.request.raw, reply.raw);
  }
}

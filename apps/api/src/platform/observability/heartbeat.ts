import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { sql, type Kysely } from 'kysely';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { DATABASE, type Database } from '../db/database.js';
import { REDIS } from '../redis/redis.js';
import { beat, HEARTBEAT_INTERVAL_MS } from './heartbeat-file.js';

/**
 * Workers and bots serve no HTTP, so their health is a file renewed while the database
 * and Redis answer. A process with the `api` role is checked over HTTP instead.
 */
@Injectable()
export class Heartbeat implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(Heartbeat.name);
  }

  onApplicationBootstrap(): void {
    if (this.config.roles.includes('api')) {
      return;
    }
    const check = async () => {
      try {
        await sql`select 1`.execute(this.db);
        await this.redis.ping();
        await beat(this.config.observability.heartbeatFile);
      } catch (error) {
        this.logger.warn({ err: error }, 'Heartbeat skipped: a dependency is not answering');
      }
    };
    void check();
    this.timer = setInterval(() => void check(), HEARTBEAT_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

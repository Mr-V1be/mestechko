import {
  Global,
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Kysely } from 'kysely';
import { LoggerModule } from 'nestjs-pino';
import type { JobDefinition } from '../shared/application/job-queue.js';
import { JOB_DEFINITIONS, JOB_QUEUE } from '../shared/application/job-queue.js';
import { CLOCK, ID_GENERATOR } from '../shared/application/ports.js';
import { UNIT_OF_WORK } from '../shared/application/unit-of-work.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { createDatabase, DATABASE, type Database } from './db/database.js';
import { KyselyUnitOfWork } from './db/kysely-unit-of-work.js';
import { loggingParams } from './observability/logging.js';
import { OperationsController } from './observability/operations.controller.js';
import { TELEMETRY, type Telemetry } from './observability/telemetry.js';
import { BullMqJobQueue } from './queue/bullmq-job-queue.js';
import { JobWorkers } from './queue/job-workers.js';
import { createRedis, REDIS } from './redis/redis.js';
import { SystemClock, UuidV7Generator } from './system-clock.js';

const STATEMENT_TIMEOUT_MS = 10_000;

/** Closes pools and connections after the application stops serving. */
@Injectable()
class PlatformLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<Database>,
    @Inject(JOB_QUEUE) private readonly queue: BullMqJobQueue,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    await this.db.destroy();
    this.redis.disconnect();
  }
}

export interface PlatformOptions {
  readonly config: AppConfig;
  readonly telemetry: Telemetry;
  readonly jobs: readonly JobDefinition<unknown>[];
}

/** Infrastructure shared by every module: configuration, storage, queues, observability. */
@Global()
@Module({})
export class PlatformModule {
  static forRoot({ config, telemetry, jobs }: PlatformOptions): DynamicModule {
    return {
      module: PlatformModule,
      imports: [LoggerModule.forRoot(loggingParams(config))],
      controllers: [OperationsController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: TELEMETRY, useValue: telemetry },
        {
          provide: DATABASE,
          useFactory: () =>
            createDatabase({
              url: config.database.url,
              poolMax: config.database.poolMax,
              applicationName: `mestechko-${config.roles.join('-')}`,
              statementTimeoutMs: STATEMENT_TIMEOUT_MS,
            }),
        },
        {
          provide: KyselyUnitOfWork,
          useFactory: (db: Kysely<Database>) => new KyselyUnitOfWork(db),
          inject: [DATABASE],
        },
        { provide: UNIT_OF_WORK, useExisting: KyselyUnitOfWork },
        { provide: CLOCK, useFactory: () => new SystemClock() },
        { provide: ID_GENERATOR, useFactory: () => new UuidV7Generator() },
        { provide: REDIS, useFactory: () => createRedis(config.redis.url, 'mestechko') },
        {
          provide: JOB_QUEUE,
          useFactory: (redis: Redis) => new BullMqJobQueue(redis),
          inject: [REDIS],
        },
        { provide: JOB_DEFINITIONS, useValue: jobs },
        JobWorkers,
        PlatformLifecycle,
      ],
      exports: [
        APP_CONFIG,
        TELEMETRY,
        DATABASE,
        KyselyUnitOfWork,
        UNIT_OF_WORK,
        CLOCK,
        ID_GENERATOR,
        REDIS,
        JOB_QUEUE,
      ],
    };
  }
}

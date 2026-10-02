import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import type { Clock } from '@mestechko/domain';
import { ModuleRef } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { loadConfig, type AppConfig } from '../../../src/platform/config/app-config.js';
import { JOB_QUEUE } from '../../../src/shared/application/job-queue.js';
import { CLOCK } from '../../../src/shared/application/ports.js';
import type { InlineJobQueue } from './inline-job-queue.js';

/** Redis database reserved for tests so queued jobs never reach a development worker. */
const TEST_REDIS_DB = '15';

export const TEST_DEMO_KEY = 'test-demo-signing-key-0123456789abcdef';

function testConfig(environment: Readonly<Record<string, string>>): AppConfig {
  const redis = new URL(process.env.REDIS_URL ?? '');
  redis.pathname = `/${TEST_REDIS_DB}`;
  return loadConfig({
    NODE_ENV: 'test',
    APP_ROLES: 'api',
    DATABASE_URL: inject('testAppUrl'),
    REDIS_URL: redis.toString(),
    DEMO_MODE: 'true',
    TELEGRAM_DEMO_SIGNING_KEY: TEST_DEMO_KEY,
    LOG_LEVEL: 'silent',
    METRICS_ENABLED: 'false',
    ...environment,
  });
}

export interface TestAppOptions {
  /** Extra environment, e.g. a bot token and the mock Bot API address. */
  readonly environment?: Readonly<Record<string, string>>;
  readonly clock?: Clock;
  /** Replaces BullMQ, so a test decides when queued work runs. */
  readonly jobs?: InlineJobQueue;
}

/** The real application wired by its composition root, served through Fastify inject. */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestFastifyApplication> {
  let builder = Test.createTestingModule({
    imports: [
      AppModule.forRoot(testConfig(options.environment ?? {}), {
        prometheus: null,
        shutdown: () => Promise.resolve(),
      }),
    ],
  });
  if (options.clock) {
    builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  }
  if (options.jobs) {
    builder = builder.overrideProvider(JOB_QUEUE).useValue(options.jobs);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  options.jobs?.attach(app.get(ModuleRef));
  return app;
}

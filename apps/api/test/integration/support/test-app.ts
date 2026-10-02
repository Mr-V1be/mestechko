import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import type { Clock } from '@mestechko/domain';
import { ModuleRef } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { loadConfig, type AppConfig } from '../../../src/platform/config/app-config.js';
import { registerBodyParsers } from '../../../src/platform/http/body-parsers.js';
import { JOB_QUEUE } from '../../../src/shared/application/job-queue.js';
import { CLOCK } from '../../../src/shared/application/ports.js';
import type { InlineJobQueue } from './inline-job-queue.js';

/** Redis database reserved for tests so queued jobs never reach a development worker. */
const TEST_REDIS_DB = '15';

export const TEST_DEMO_KEY = 'test-demo-signing-key-0123456789abcdef';
export const TEST_PAY_SECRET = 'test-pay-secret-key-0123456789abcdef';
export const TEST_PAY_WEBHOOK_SECRET = 'test-pay-webhook-secret-0123456789abcdef';

export function testRedisUrl(): string {
  const redis = new URL(process.env.REDIS_URL ?? '');
  redis.pathname = `/${TEST_REDIS_DB}`;
  return redis.toString();
}

function testConfig(environment: Readonly<Record<string, string>>): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    APP_ROLES: 'api',
    DATABASE_URL: inject('testAppUrl'),
    REDIS_URL: testRedisUrl(),
    DEMO_MODE: 'true',
    TELEGRAM_DEMO_SIGNING_KEY: TEST_DEMO_KEY,
    TEST_PAY_SECRET_KEY: TEST_PAY_SECRET,
    TEST_PAY_WEBHOOK_SECRET: TEST_PAY_WEBHOOK_SECRET,
    TEST_PAY_EMULATOR_ENABLED: 'true',
    WIDGET_SIGNING_KEY: 'test-widget-signing-key-0123456789abcdef',
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
    rawBody: true,
  });
  registerBodyParsers(app.getHttpAdapter().getInstance());
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  options.jobs?.attach(app.get(ModuleRef));
  return app;
}

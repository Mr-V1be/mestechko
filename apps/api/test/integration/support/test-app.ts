import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { inject } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { loadConfig, type AppConfig } from '../../../src/platform/config/app-config.js';

/** Redis database reserved for tests so queued jobs never reach a development worker. */
const TEST_REDIS_DB = '15';

export const TEST_DEMO_KEY = 'test-demo-signing-key-0123456789abcdef';

function testConfig(): AppConfig {
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
  });
}

/** The real application wired by its composition root, served through Fastify inject. */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(testConfig(), { prometheus: null, shutdown: () => Promise.resolve() }),
    new FastifyAdapter(),
    { logger: false },
  );
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

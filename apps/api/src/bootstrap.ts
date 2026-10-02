import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { AppConfig } from './platform/config/app-config.js';
import { REQUEST_ID_HEADER, requestIdOf } from './platform/observability/logging.js';
import type { Telemetry } from './platform/observability/telemetry.js';

const BODY_LIMIT_BYTES = 64 * 1024;

/** Starts the HTTP API when the process has the `api` role, otherwise only the workers. */
export async function bootstrap(
  config: AppConfig,
  telemetry: Telemetry,
): Promise<() => Promise<void>> {
  const module = AppModule.forRoot(config, telemetry);
  if (!config.roles.includes('api')) {
    const context = await NestFactory.createApplicationContext(module, { bufferLogs: true });
    context.useLogger(context.get(Logger));
    context.enableShutdownHooks();
    return () => context.close();
  }
  const app = await NestFactory.create<NestFastifyApplication>(
    module,
    new FastifyAdapter({
      trustProxy: true,
      bodyLimit: BODY_LIMIT_BYTES,
      requestIdHeader: false,
      genReqId: requestIdOf,
    }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (request, reply) => {
      void reply.header(REQUEST_ID_HEADER, request.id);
    });
  await app.register(fastifyCookie);
  await app.register(fastifyHelmet);
  if (config.http.corsOrigins.length > 0) {
    app.enableCors({ origin: [...config.http.corsOrigins], credentials: true });
  }
  app.enableShutdownHooks();
  await app.listen({ host: config.http.host, port: config.http.port });
  return () => app.close();
}

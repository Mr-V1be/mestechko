import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { trace } from '@opentelemetry/api';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config.js';
import type { LogContextCarrier } from '../http/principal.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;
const QUIET_PATHS = ['/health', '/metrics'];

/** Keeps a caller's well-formed request id for correlation, otherwise issues a new one. */
export function requestIdOf(request: { readonly headers: IncomingMessage['headers'] }): string {
  const header = request.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
}

/** Structured JSON logs with request, tenant and trace correlation; secrets redacted. */
export function loggingParams(config: AppConfig): Params {
  const pretty = config.environment === 'development';
  return {
    pinoHttp: {
      level: config.observability.logLevel,
      ...(pretty ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.query.initData',
        ],
        censor: '[redacted]',
      },
      customProps: (request: IncomingMessage) => ({ ...(request as LogContextCarrier).logContext }),
      autoLogging: {
        ignore: (request: IncomingMessage) =>
          QUIET_PATHS.some((path) => request.url?.startsWith(path) ?? false),
      },
      mixin: () => {
        const span = trace.getActiveSpan();
        return span ? { traceId: span.spanContext().traceId } : {};
      },
    },
  };
}

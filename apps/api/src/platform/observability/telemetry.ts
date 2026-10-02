import { metrics } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { register } from 'import-in-the-middle/register-hooks.mjs';
import type { AppConfig } from '../config/app-config.js';

const UNTRACED_PATHS = ['/health', '/metrics'];
/**
 * Only instrumented modules go through the ESM loader hook: wrapping everything breaks
 * libraries with circular imports (the Temporal polyfill among them).
 */
const INSTRUMENTED_MODULES = ['pg', 'http', 'node:http', 'https', 'node:https'];

export interface Telemetry {
  /** Prometheus reader whose output `/metrics` serves; `null` when metrics are off. */
  readonly prometheus: PrometheusExporter | null;
  shutdown(): Promise<void>;
}

/**
 * Starts tracing and metrics. Must run before the application modules are imported:
 * the synchronous loader hook lets instrumentations patch `pg` and `http` as they load.
 */
export function startTelemetry(config: AppConfig): Telemetry {
  register({ include: INSTRUMENTED_MODULES });
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.observability.serviceName,
  });

  const endpoint = config.observability.otlpEndpoint;
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: endpoint
      ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))]
      : [],
  });
  tracerProvider.register();

  const prometheus = config.observability.metricsEnabled
    ? new PrometheusExporter({ preventServerStart: true })
    : null;
  const meterProvider = new MeterProvider({ resource, readers: prometheus ? [prometheus] : [] });
  metrics.setGlobalMeterProvider(meterProvider);

  registerInstrumentations({
    tracerProvider,
    meterProvider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) =>
          UNTRACED_PATHS.some((path) => request.url?.startsWith(path) ?? false),
      }),
      new PgInstrumentation(),
    ],
  });

  return {
    prometheus,
    async shutdown() {
      await Promise.all([tracerProvider.shutdown(), meterProvider.shutdown()]);
    },
  };
}

export const TELEMETRY = Symbol('TELEMETRY');

import { z } from 'zod';

export const appRoles = ['api', 'worker'] as const;
export type AppRole = (typeof appRoles)[number];

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');
const list = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ROLES: list.pipe(z.array(z.enum(appRoles)).min(1)).default(['api', 'worker']),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(46_210),
    CORS_ORIGINS: list.pipe(z.array(z.url())).default([]),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.url(),
    TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
    TELEGRAM_INIT_DATA_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
    DEMO_MODE: flag.default(false),
    TELEGRAM_DEMO_SIGNING_KEY: z.string().min(32).optional(),
    ISDAYOFF_BASE_URL: z.url().default('https://isdayoff.ru'),
    EXTERNAL_HTTP_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SECURE: flag.optional(),
    LOG_LEVEL: z.enum(logLevels).default('info'),
    METRICS_ENABLED: flag.default(true),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SERVICE_NAME: z.string().default('mestechko-api'),
  })
  .refine((env) => !env.DEMO_MODE || env.TELEGRAM_DEMO_SIGNING_KEY !== undefined, {
    message: 'TELEGRAM_DEMO_SIGNING_KEY is required when DEMO_MODE=true',
    path: ['TELEGRAM_DEMO_SIGNING_KEY'],
  });

export interface AppConfig {
  readonly environment: 'development' | 'test' | 'production';
  readonly roles: readonly AppRole[];
  readonly http: {
    readonly host: string;
    readonly port: number;
    readonly corsOrigins: readonly string[];
  };
  readonly database: { readonly url: string; readonly poolMax: number };
  readonly redis: { readonly url: string };
  readonly telegram: { readonly botToken: string | null; readonly initDataTtlSeconds: number };
  readonly demo: { readonly enabled: boolean; readonly telegramSigningKey: string | null };
  readonly calendar: { readonly isDayOffBaseUrl: string };
  readonly externalHttp: { readonly timeoutMs: number };
  readonly sessions: { readonly ttlDays: number; readonly cookieSecure: boolean };
  readonly observability: {
    readonly logLevel: (typeof logLevels)[number];
    readonly metricsEnabled: boolean;
    readonly otlpEndpoint: string | null;
    readonly serviceName: string;
  };
}

export class ConfigurationError extends Error {
  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigurationError';
  }
}

/** Reads configuration from the environment. Empty values count as unset. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const parsed = environmentSchema.safeParse(present);
  if (!parsed.success) {
    // Only keys and messages are reported: values may contain secrets.
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  return {
    environment: env.NODE_ENV,
    roles: env.APP_ROLES,
    http: { host: env.API_HOST, port: env.API_PORT, corsOrigins: env.CORS_ORIGINS },
    database: { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX },
    redis: { url: env.REDIS_URL },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN ?? null,
      initDataTtlSeconds: env.TELEGRAM_INIT_DATA_TTL_SECONDS,
    },
    demo: { enabled: env.DEMO_MODE, telegramSigningKey: env.TELEGRAM_DEMO_SIGNING_KEY ?? null },
    calendar: { isDayOffBaseUrl: env.ISDAYOFF_BASE_URL },
    externalHttp: { timeoutMs: env.EXTERNAL_HTTP_TIMEOUT_MS },
    sessions: {
      ttlDays: env.SESSION_TTL_DAYS,
      cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      metricsEnabled: env.METRICS_ENABLED,
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
      serviceName: env.OTEL_SERVICE_NAME,
    },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

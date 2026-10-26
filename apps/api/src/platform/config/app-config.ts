import { checkoutPresentationIds, type CheckoutPresentation } from '@slotwise/domain';
import { z } from 'zod';
import { DEFAULT_HEARTBEAT_FILE } from '../observability/heartbeat-file.js';
import { systemNameOf } from '../system-name.js';

/**
 * Roles of a process: `api` serves HTTP, `worker` runs queued jobs, `bot` consumes
 * messenger updates by long polling (one such process per bot).
 */
export const appRoles = ['api', 'worker', 'bot'] as const;
export type AppRole = (typeof appRoles)[number];

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');
const httpsUrl = z.url().refine((value) => value.startsWith('https://'), {
  message: 'Must be an https:// address',
});
const list = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

/** Settings each payment provider needs before the API starts. */
const paymentProviderConfigured: Record<
  'test',
  (env: {
    TEST_PAY_SECRET_KEY?: string | undefined;
    TEST_PAY_WEBHOOK_SECRET?: string | undefined;
  }) => boolean
> = {
  test: (env) => env.TEST_PAY_SECRET_KEY !== undefined && env.TEST_PAY_WEBHOOK_SECRET !== undefined,
};

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ROLES: list.pipe(z.array(z.enum(appRoles)).min(1)).default(['api', 'worker', 'bot']),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(46_210),
    CORS_ORIGINS: list.pipe(z.array(z.url())).default([]),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.url(),
    TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
    TELEGRAM_BOT_USERNAME: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9_]{3,31}$/)
      .optional(),
    TELEGRAM_API_ROOT: z.url().default('https://api.telegram.org'),
    TELEGRAM_UPDATES_MODE: z.enum(['polling', 'webhook']).default('polling'),
    TELEGRAM_WEBHOOK_URL: httpsUrl.optional(),
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/)
      .optional(),
    TELEGRAM_INIT_DATA_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
    MINIAPP_PUBLIC_URL: httpsUrl.optional(),
    MAX_BOT_TOKEN: z.string().min(16).optional(),
    MAX_API_BASE_URL: z.url().default('https://platform-api2.max.ru'),
    MAX_EMULATOR_ENABLED: flag.default(false),
    PAYMENTS_PROVIDER: z.enum(['test']).default('test'),
    TEST_PAY_API_URL: z.url().default('http://127.0.0.1:46210/test-pay/api'),
    TEST_PAY_SECRET_KEY: z.string().min(24).optional(),
    TEST_PAY_WEBHOOK_SECRET: z.string().min(24).optional(),
    TEST_PAY_EMULATOR_ENABLED: flag.default(false),
    TEST_PAY_WEBHOOK_URL: z.url().default('http://127.0.0.1:46210/v1/payments/webhooks/test'),
    TEST_PAY_CHECKOUT_BASE_URL: z
      .string()
      .regex(/^(https?:\/\/[^\s]+|\/[^\s]*)$/)
      .default('/test-pay'),
    TEST_PAY_CHECKOUT: z.enum(checkoutPresentationIds).default('embedded'),
    PAYMENTS_RETURN_PAGE_URL: z.url().optional(),
    WIDGET_SIGNING_KEY: z.string().min(32).optional(),
    DEMO_MODE: flag.default(false),
    TELEGRAM_DEMO_SIGNING_KEY: z.string().min(32).optional(),
    ISDAYOFF_BASE_URL: z.url().default('https://isdayoff.ru'),
    EXTERNAL_HTTP_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SECURE: flag.optional(),
    // The path of the session cookie: `/` when the API has a name of its own; the API's path
    // (e.g. `/api`) when the apps and the API share one name, so pages never carry it.
    SESSION_COOKIE_PATH: z
      .string()
      .regex(/^\/[\w\-./]*$/, { message: 'Must be a path starting with /' })
      .default('/'),
    LOG_LEVEL: z.enum(logLevels).default('info'),
    METRICS_ENABLED: flag.default(true),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SERVICE_NAME: z.string().default(systemNameOf('api')),
    HEARTBEAT_FILE: z.string().min(1).default(DEFAULT_HEARTBEAT_FILE),
  })
  .refine((env) => !env.DEMO_MODE || env.TELEGRAM_DEMO_SIGNING_KEY !== undefined, {
    message: 'TELEGRAM_DEMO_SIGNING_KEY is required when DEMO_MODE=true',
    path: ['TELEGRAM_DEMO_SIGNING_KEY'],
  })
  .refine(
    (env) =>
      env.TELEGRAM_UPDATES_MODE !== 'webhook' ||
      env.TELEGRAM_BOT_TOKEN === undefined ||
      (env.TELEGRAM_WEBHOOK_URL !== undefined && env.TELEGRAM_WEBHOOK_SECRET !== undefined),
    {
      message: 'Webhook mode needs TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET',
      path: ['TELEGRAM_UPDATES_MODE'],
    },
  )
  .refine((env) => !env.MAX_EMULATOR_ENABLED || (env.DEMO_MODE && env.MAX_BOT_TOKEN), {
    message: 'The MAX emulator runs only in demo mode with MAX_BOT_TOKEN set',
    path: ['MAX_EMULATOR_ENABLED'],
  })
  .refine((env) => paymentProviderConfigured[env.PAYMENTS_PROVIDER](env), {
    message:
      'The payment provider is not configured (for test: TEST_PAY_SECRET_KEY and TEST_PAY_WEBHOOK_SECRET)',
    path: ['PAYMENTS_PROVIDER'],
  })
  .refine((env) => !env.TEST_PAY_EMULATOR_ENABLED || env.DEMO_MODE, {
    message: 'The payment provider emulator runs only in demo mode',
    path: ['TEST_PAY_EMULATOR_ENABLED'],
  });

/** How a bot receives updates: it asks for them, or the messenger pushes them. */
export type UpdatesMode =
  | { readonly kind: 'polling' }
  | { readonly kind: 'webhook'; readonly url: string; readonly secret: string };

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
  readonly telegram: {
    readonly botToken: string | null;
    readonly botUsername: string | null;
    readonly apiRoot: string;
    readonly updates: UpdatesMode;
    readonly initDataTtlSeconds: number;
  };
  /** Public https address of the client app; buttons that open it exist only with it. */
  readonly miniApp: { readonly publicUrl: string | null };
  readonly max: {
    readonly botToken: string | null;
    readonly apiBaseUrl: string;
    /** Serves an emulator of the MAX Bot API for the demo. */
    readonly emulatorEnabled: boolean;
  };
  readonly payments: {
    /** Provider prepayments go through; adapters are registered per id. */
    readonly provider: 'test';
    readonly test: {
      readonly apiUrl: string;
      readonly secretKey: string | null;
      readonly webhookSecret: string | null;
      /** Serves an emulator of the test provider (API, payment page, webhooks) for the demo. */
      readonly emulatorEnabled: boolean;
      readonly webhookUrl: string;
      readonly checkoutBaseUrl: string;
      /** Where the test provider's page opens: in place of the app or in the browser. */
      readonly checkout: CheckoutPresentation;
    };
    /** The neutral page payers return to from a page opened outside the app. */
    readonly returnPageUrl: string | null;
  };
  /** Signs the tokens that let a website visitor see the booking they made. */
  readonly widget: { readonly signingKey: string | null };
  readonly demo: { readonly enabled: boolean; readonly telegramSigningKey: string | null };
  readonly calendar: { readonly isDayOffBaseUrl: string };
  readonly externalHttp: { readonly timeoutMs: number };
  readonly sessions: {
    readonly ttlDays: number;
    readonly cookieSecure: boolean;
    readonly cookiePath: string;
  };
  readonly observability: {
    readonly logLevel: (typeof logLevels)[number];
    readonly metricsEnabled: boolean;
    readonly otlpEndpoint: string | null;
    readonly serviceName: string;
    /** Renewed by processes without HTTP; see `heartbeat-file.ts`. */
    readonly heartbeatFile: string;
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
      botUsername: env.TELEGRAM_BOT_USERNAME ?? null,
      apiRoot: env.TELEGRAM_API_ROOT,
      updates:
        env.TELEGRAM_UPDATES_MODE === 'webhook' &&
        env.TELEGRAM_WEBHOOK_URL !== undefined &&
        env.TELEGRAM_WEBHOOK_SECRET !== undefined
          ? { kind: 'webhook', url: env.TELEGRAM_WEBHOOK_URL, secret: env.TELEGRAM_WEBHOOK_SECRET }
          : { kind: 'polling' },
      initDataTtlSeconds: env.TELEGRAM_INIT_DATA_TTL_SECONDS,
    },
    miniApp: { publicUrl: env.MINIAPP_PUBLIC_URL?.replace(/\/+$/, '') ?? null },
    max: {
      botToken: env.MAX_BOT_TOKEN ?? null,
      apiBaseUrl: env.MAX_API_BASE_URL.replace(/\/+$/, ''),
      emulatorEnabled: env.MAX_EMULATOR_ENABLED,
    },
    payments: {
      provider: env.PAYMENTS_PROVIDER,
      test: {
        apiUrl: env.TEST_PAY_API_URL.replace(/\/+$/, ''),
        secretKey: env.TEST_PAY_SECRET_KEY ?? null,
        webhookSecret: env.TEST_PAY_WEBHOOK_SECRET ?? null,
        emulatorEnabled: env.TEST_PAY_EMULATOR_ENABLED,
        webhookUrl: env.TEST_PAY_WEBHOOK_URL,
        checkoutBaseUrl: env.TEST_PAY_CHECKOUT_BASE_URL.replace(/\/+$/, ''),
        checkout: env.TEST_PAY_CHECKOUT,
      },
      returnPageUrl: env.PAYMENTS_RETURN_PAGE_URL ?? null,
    },
    widget: { signingKey: env.WIDGET_SIGNING_KEY ?? null },
    demo: { enabled: env.DEMO_MODE, telegramSigningKey: env.TELEGRAM_DEMO_SIGNING_KEY ?? null },
    calendar: { isDayOffBaseUrl: env.ISDAYOFF_BASE_URL },
    externalHttp: { timeoutMs: env.EXTERNAL_HTTP_TIMEOUT_MS },
    sessions: {
      ttlDays: env.SESSION_TTL_DAYS,
      cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
      cookiePath: env.SESSION_COOKIE_PATH,
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      metricsEnabled: env.METRICS_ENABLED,
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
      serviceName: env.OTEL_SERVICE_NAME,
      heartbeatFile: env.HEARTBEAT_FILE,
    },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Creates `.env` from `.env.example` with local defaults and fresh random secrets.
 * Existing values are kept, so the command is safe to re-run. Secrets are never printed.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const examplePath = `${root}.env.example`;
const envPath = `${root}.env`;

const secret = (bytes: number): string => randomBytes(bytes).toString('base64url');

function parse(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of content.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], match[2]);
    }
  }
  return values;
}

const existing = existsSync(envPath)
  ? parse(readFileSync(envPath, 'utf8'))
  : new Map<string, string>();
const pick = (key: string, fallback: () => string): string => {
  const current = existing.get(key);
  return current !== undefined && current !== '' ? current : fallback();
};

const postgresPassword = pick('POSTGRES_PASSWORD', () => secret(24));
const appPassword = (() => {
  const url = existing.get('DATABASE_URL');
  return url ? decodeURIComponent(new URL(url).password) : secret(24);
})();
const redisPassword = pick('REDIS_PASSWORD', () => secret(24));

const defaults: Record<string, () => string> = {
  NODE_ENV: () => 'development',
  APP_ROLES: () => 'api,worker,bot',
  API_HOST: () => '127.0.0.1',
  API_PORT: () => '46210',
  LOG_LEVEL: () => 'info',
  POSTGRES_PASSWORD: () => postgresPassword,
  DATABASE_ADMIN_URL: () =>
    `postgres://mestechko:${encodeURIComponent(postgresPassword)}@127.0.0.1:46201/mestechko`,
  DATABASE_URL: () =>
    `postgres://mestechko_app:${encodeURIComponent(appPassword)}@127.0.0.1:46201/mestechko`,
  DATABASE_POOL_MAX: () => '10',
  REDIS_PASSWORD: () => redisPassword,
  REDIS_URL: () => `redis://:${encodeURIComponent(redisPassword)}@127.0.0.1:46202/0`,
  DEMO_MODE: () => 'true',
  TELEGRAM_DEMO_SIGNING_KEY: () => secret(32),
  TELEGRAM_UPDATES_MODE: () => 'polling',
  MAX_BOT_TOKEN: () => secret(24),
  MAX_API_BASE_URL: () => 'http://127.0.0.1:46210/max-emulator',
  MAX_EMULATOR_ENABLED: () => 'true',
  PAYMENTS_PROVIDER: () => 'test',
  TEST_PAY_API_URL: () => 'http://127.0.0.1:46210/test-pay/api',
  TEST_PAY_SECRET_KEY: () => secret(32),
  TEST_PAY_WEBHOOK_SECRET: () => secret(32),
  TEST_PAY_EMULATOR_ENABLED: () => 'true',
  TEST_PAY_WEBHOOK_URL: () => 'http://127.0.0.1:46210/v1/payments/webhooks/test',
  TEST_PAY_CHECKOUT_BASE_URL: () => '/test-pay',
  WIDGET_SIGNING_KEY: () => secret(32),
  SESSION_TTL_DAYS: () => '30',
  COOKIE_SECURE: () => 'false',
  ISDAYOFF_BASE_URL: () => 'https://isdayoff.ru',
  EXTERNAL_HTTP_TIMEOUT_MS: () => '5000',
  METRICS_ENABLED: () => 'true',
  OTEL_SERVICE_NAME: () => 'mestechko-api',
  VITE_API_BASE_URL: () => '/api',
  VITE_DEMO_MODE: () => 'true',
  VITE_WIDGET_BASE_URL: () => 'http://127.0.0.1:46240',
};

const output = readFileSync(examplePath, 'utf8')
  .split('\n')
  .map((line) => {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match?.[1]) {
      return line;
    }
    const key = match[1];
    const fallback = defaults[key] ?? (() => '');
    return `${key}=${pick(key, fallback)}`;
  })
  .join('\n');

writeFileSync(envPath, output, { mode: 0o600 });
console.log(existsSync(envPath) ? 'Updated .env (existing values kept).' : 'Created .env.');

/**
 * A clean demo for captures: a scratch database seeded from scratch, its own API,
 * workers and previews of the built apps on separate ports. The working demo database
 * is never touched, and scenarios that book or cancel cannot leak into the next run.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const SCRATCH_DATABASE = 'slotwise_screenshots';
/** Its own Redis database: queues and bot state never mix with development. */
const SCRATCH_REDIS_DB = '3';
export const scratchPorts = {
  api: 46212,
  cabinet: 46223,
  miniapp: 46233,
  widget: 46243,
  landing: 46253,
} as const;
type App = Exclude<keyof typeof scratchPorts, 'api'>;
const READY_TIMEOUT_MS = 90_000;
const POLL_MS = 1_000;
/** The seed plans MAX notices due now; workers deliver them within the minute. */
const DELIVERY_WAIT_MS = 75_000;

const url = (port: number) => `http://127.0.0.1:${String(port)}`;

function withDatabase(value: string | undefined, database: string): string {
  if (!value) {
    throw new Error('DATABASE_URL and DATABASE_ADMIN_URL are required (run `pnpm env:init`).');
  }
  const parsed = new URL(value);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function withRedisDb(value: string | undefined, db: string): string {
  if (!value) {
    throw new Error('REDIS_URL is required (run `pnpm env:init`).');
  }
  const parsed = new URL(value);
  parsed.pathname = `/${db}`;
  return parsed.toString();
}

const api = url(scratchPorts.api);

export const scratchEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_ADMIN_URL: withDatabase(process.env.DATABASE_ADMIN_URL, SCRATCH_DATABASE),
  DATABASE_URL: withDatabase(process.env.DATABASE_URL, SCRATCH_DATABASE),
  REDIS_URL: withRedisDb(process.env.REDIS_URL, SCRATCH_REDIS_DB),
  API_PORT: String(scratchPorts.api),
  APP_ROLES: 'api,worker,bot',
  // No real bot: captures never reach Telegram. MAX runs against the local emulator.
  TELEGRAM_BOT_TOKEN: '',
  MAX_API_BASE_URL: `${api}/max-emulator`,
  LOG_LEVEL: 'warn',
  METRICS_ENABLED: 'false',
  SLOTWISE_API_URL: api,
  // The test payment provider sends webhooks to this API and payers back through the apps.
  TEST_PAY_API_URL: `${api}/test-pay/api`,
  TEST_PAY_WEBHOOK_URL: `${api}/v1/payments/webhooks/test`,
  PAYMENTS_RETURN_PAGE_URL: `${api}/v1/payments/return`,
  // The apps link to each other and the cabinet shows this run's widget code.
  VITE_WIDGET_BASE_URL: url(scratchPorts.widget),
  VITE_LANDING_URL: url(scratchPorts.landing),
  VITE_CABINET_URL: url(scratchPorts.cabinet),
  VITE_MINIAPP_URL: url(scratchPorts.miniapp),
};

export const scratchUrls = Object.fromEntries(
  Object.entries(scratchPorts).map(([name, port]) => [name, url(port)]),
) as Record<keyof typeof scratchPorts, string>;

export function step(
  title: string,
  command: string,
  args: readonly string[],
  env = scratchEnv,
): void {
  console.log(`• ${title}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${title} failed`);
  }
}

async function until(what: string, check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const reachable = (target: string) => async () => (await fetch(target)).ok;

/** Where each app answers once its preview is up. */
const readyPaths: Readonly<Record<App, string>> = {
  cabinet: '/',
  miniapp: '/',
  widget: '/demo/siren.html',
  landing: '/',
};

/**
 * Brings the clean demo up, runs `work` against it and takes everything down again,
 * whatever happens in between.
 */
export async function withScratchStack(
  options: { readonly apps: readonly App[]; readonly build: boolean },
  work: () => Promise<void>,
): Promise<void> {
  const running: ChildProcess[] = [];
  const start = (title: string, command: string, args: readonly string[], cwd: string) => {
    console.log(`• ${title}`);
    running.push(
      spawn(command, args, { cwd, env: scratchEnv, stdio: ['ignore', 'ignore', 'inherit'] }),
    );
  };
  try {
    // Recreated from the working connection, which names the database to keep.
    step(
      'Scratch database',
      'pnpm',
      ['--filter', '@slotwise/api', 'db:recreate', '--database', SCRATCH_DATABASE],
      process.env,
    );
    step('Application role', 'pnpm', ['--filter', '@slotwise/api', 'db:provision']);
    step('Migrations', 'pnpm', ['--filter', '@slotwise/api', 'db:migrate']);
    step('Demo data', 'pnpm', ['--filter', '@slotwise/api', 'db:seed']);
    if (options.build) {
      for (const app of options.apps) {
        step(`Build ${app}`, 'pnpm', ['--filter', `@slotwise/${app}`, 'build']);
      }
    }
    start(
      'API with workers and bots',
      process.execPath,
      ['--conditions=@slotwise/source', '--import', 'tsx', 'src/main.ts'],
      `${root}apps/api`,
    );
    for (const app of options.apps) {
      start(
        `${app} preview`,
        `${root}apps/${app}/node_modules/.bin/vite`,
        ['preview', '--port', String(scratchPorts[app]), '--strictPort', '--logLevel', 'warn'],
        `${root}apps/${app}`,
      );
    }
    await until('the API', reachable(`${scratchUrls.api}/health/ready`));
    await until('the previews', async () => {
      const checks = await Promise.all(
        options.apps.map((app) => reachable(`${scratchUrls[app]}${readyPaths[app]}`)()),
      );
      return checks.every(Boolean);
    });
    console.log('• Waiting for the seeded MAX messages to be delivered');
    await new Promise((resolve) => setTimeout(resolve, DELIVERY_WAIT_MS));
    await work();
  } finally {
    for (const child of running) {
      child.kill('SIGTERM');
    }
  }
}

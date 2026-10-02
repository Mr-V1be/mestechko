/**
 * Screenshots on a clean demo: a scratch database seeded from scratch, its own API,
 * workers and previews of the built apps on separate ports. The working demo database
 * is never touched, and scenarios that book or cancel cannot leak into the next run.
 *
 *   pnpm screenshots [--out docs/screenshots/m3] [--only miniapp|cabinet] [--viewport 390]
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const SCRATCH_DATABASE = 'mestechko_screenshots';
/** Its own Redis database: queues and bot state never mix with development. */
const SCRATCH_REDIS_DB = '3';
const PORTS = { api: 46212, cabinet: 46223, miniapp: 46233 } as const;
const READY_TIMEOUT_MS = 90_000;
const POLL_MS = 1_000;
/** The seed plans MAX notices due now; workers deliver them within the minute. */
const DELIVERY_WAIT_MS = 75_000;

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'docs/screenshots/m3' },
    only: { type: 'string' },
    viewport: { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
  },
});

function withDatabase(url: string | undefined, database: string): string {
  if (!url) {
    throw new Error('DATABASE_URL and DATABASE_ADMIN_URL are required (run `pnpm env:init`).');
  }
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function withRedisDb(url: string | undefined, db: string): string {
  if (!url) {
    throw new Error('REDIS_URL is required (run `pnpm env:init`).');
  }
  const parsed = new URL(url);
  parsed.pathname = `/${db}`;
  return parsed.toString();
}

const scratchEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_ADMIN_URL: withDatabase(process.env.DATABASE_ADMIN_URL, SCRATCH_DATABASE),
  DATABASE_URL: withDatabase(process.env.DATABASE_URL, SCRATCH_DATABASE),
  REDIS_URL: withRedisDb(process.env.REDIS_URL, SCRATCH_REDIS_DB),
  API_PORT: String(PORTS.api),
  APP_ROLES: 'api,worker,bot',
  // No real bot: screenshots never reach Telegram. MAX runs against the local emulator.
  TELEGRAM_BOT_TOKEN: '',
  MAX_API_BASE_URL: `http://127.0.0.1:${String(PORTS.api)}/max-emulator`,
  LOG_LEVEL: 'warn',
  METRICS_ENABLED: 'false',
  MESTECHKO_API_URL: `http://127.0.0.1:${String(PORTS.api)}`,
};

function step(title: string, command: string, args: readonly string[], env = scratchEnv): void {
  console.log(`• ${title}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${title} failed`);
  }
}

const running: ChildProcess[] = [];

function start(title: string, command: string, args: readonly string[], cwd: string): void {
  console.log(`• ${title}`);
  const child = spawn(command, args, {
    cwd,
    env: scratchEnv,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  running.push(child);
}

async function until(what: string, check: () => Promise<boolean>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const reachable = (url: string) => async () => (await fetch(url)).ok;

try {
  // Recreated from the working connection, which names the database to keep.
  step(
    'Scratch database',
    'pnpm',
    ['--filter', '@mestechko/api', 'db:recreate', '--database', SCRATCH_DATABASE],
    process.env,
  );
  step('Application role', 'pnpm', ['--filter', '@mestechko/api', 'db:provision']);
  step('Migrations', 'pnpm', ['--filter', '@mestechko/api', 'db:migrate']);
  step('Demo data', 'pnpm', ['--filter', '@mestechko/api', 'db:seed']);
  if (!values['skip-build']) {
    step('Build Mini App', 'pnpm', ['--filter', '@mestechko/miniapp', 'build']);
    step('Build cabinet', 'pnpm', ['--filter', '@mestechko/cabinet', 'build']);
  }
  start(
    'API with workers and bots',
    process.execPath,
    ['--conditions=@mestechko/source', '--import', 'tsx', 'src/main.ts'],
    `${root}apps/api`,
  );
  for (const app of ['cabinet', 'miniapp'] as const) {
    start(
      `${app} preview`,
      `${root}apps/${app}/node_modules/.bin/vite`,
      ['preview', '--port', String(PORTS[app]), '--strictPort', '--logLevel', 'warn'],
      `${root}apps/${app}`,
    );
  }
  await until(
    'the API',
    reachable(`http://127.0.0.1:${String(PORTS.api)}/health/ready`),
    READY_TIMEOUT_MS,
  );
  await until(
    'the previews',
    async () =>
      (await reachable(`http://127.0.0.1:${String(PORTS.cabinet)}/`)()) &&
      (await reachable(`http://127.0.0.1:${String(PORTS.miniapp)}/`)()),
    READY_TIMEOUT_MS,
  );
  console.log('• Waiting for the seeded MAX messages to be delivered');
  await new Promise((resolve) => setTimeout(resolve, DELIVERY_WAIT_MS));
  step(
    'Screenshots',
    process.execPath,
    [
      'tooling/screenshots/capture.ts',
      '--out',
      values.out,
      '--cabinet',
      `http://127.0.0.1:${String(PORTS.cabinet)}`,
      '--miniapp',
      `http://127.0.0.1:${String(PORTS.miniapp)}`,
      ...(values.only ? ['--only', values.only] : []),
      ...(values.viewport ? ['--viewport', values.viewport] : []),
    ],
    process.env,
  );
} finally {
  for (const child of running) {
    child.kill('SIGTERM');
  }
}

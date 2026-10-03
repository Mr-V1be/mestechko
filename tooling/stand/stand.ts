/**
 * The local stand, left running for the owner after the session ends:
 *
 *   pnpm stand [--reset]   PostgreSQL and Redis, migrations, then the API with bots and
 *                          the web apps, each detached (own session) with a log in
 *                          .run/logs; --reset returns the demo data to its seed first
 *   pnpm stand:status      what runs, on which port, and whether it answers
 *   pnpm stand:stop        stops the processes and docker compose
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  logFile,
  pidFile,
  root,
  runDir,
  standServices,
  urlOf,
  type StandService,
} from './services.ts';

const READY_TIMEOUT_MS = 120_000;
const POLL_MS = 1_000;
const STOP_GRACE_MS = 8_000;

function run(title: string, command: string, args: readonly string[]): void {
  console.log(`• ${title}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${title} failed`);
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pidOf(service: StandService): number | null {
  try {
    const pid = Number(readFileSync(pidFile(service), 'utf8'));
    return alive(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function answers(service: StandService): Promise<boolean> {
  try {
    const response = await fetch(urlOf(service, service.readyPath), {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

/** Starts a service in its own session, so it outlives the terminal that started it. */
function launch(service: StandService): number {
  const log = openSync(logFile(service), 'a');
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  if (child.pid === undefined) {
    throw new Error(`${service.name} did not start`);
  }
  child.unref();
  writeFileSync(pidFile(service), String(child.pid));
  return child.pid;
}

async function start(reset: boolean): Promise<void> {
  mkdirSync(`${runDir}/logs`, { recursive: true });
  mkdirSync(`${runDir}/pids`, { recursive: true });
  run('PostgreSQL and Redis', 'docker', ['compose', 'up', '-d', '--wait']);
  run('Migrations', 'pnpm', ['db:migrate']);
  if (reset) {
    run('Demo data back to the seed', 'pnpm', ['demo:reset']);
  }
  for (const service of standServices) {
    const running = pidOf(service);
    if (running !== null) {
      console.log(`• ${service.name}: already running (pid ${String(running)})`);
      continue;
    }
    console.log(`• ${service.name}: pid ${String(launch(service))}`);
  }
  const ready = await Promise.all(
    standServices.map(async (service) => ({
      service,
      ok: await waitUntil(() => answers(service), READY_TIMEOUT_MS),
    })),
  );
  printSummary(ready);
  if (ready.some((entry) => !entry.ok)) {
    process.exitCode = 1;
  }
}

function printSummary(entries: readonly { service: StandService; ok: boolean }[]): void {
  console.log('');
  for (const { service, ok } of entries) {
    console.log(`${ok ? '✓' : '✗'} ${urlOf(service).padEnd(42)} ${service.title}`);
  }
  console.log(`\nLogs: ${runDir}/logs`);
}

async function status(): Promise<void> {
  const entries = await Promise.all(
    standServices.map(async (service) => ({ service, ok: await answers(service) })),
  );
  for (const { service, ok } of entries) {
    const pid = pidOf(service);
    console.log(
      `${ok ? '✓' : '✗'} ${service.name.padEnd(8)} ${pid === null ? 'not started by the stand' : `pid ${String(pid)}`}`,
    );
  }
  printSummary(entries);
  run('Containers', 'docker', ['compose', 'ps', '--format', 'table {{.Service}}\t{{.Status}}']);
}

async function stop(): Promise<void> {
  for (const service of standServices) {
    const pid = pidOf(service);
    if (pid === null) {
      rmSync(pidFile(service), { force: true });
      continue;
    }
    // The service leads its own process group: the signal reaches its children too.
    process.kill(-pid, 'SIGTERM');
    const gone = await waitUntil(() => Promise.resolve(!alive(pid)), STOP_GRACE_MS);
    if (!gone) {
      process.kill(-pid, 'SIGKILL');
    }
    rmSync(pidFile(service), { force: true });
    console.log(`• ${service.name}: stopped`);
  }
  run('PostgreSQL and Redis', 'docker', ['compose', 'stop']);
}

const [command = 'start', ...flags] = process.argv.slice(2);
const commands: Readonly<Record<string, () => Promise<void>>> = {
  start: () => start(flags.includes('--reset')),
  status,
  stop,
};
const action = commands[command];
if (!action) {
  throw new Error(`Unknown command ${command}: start, status or stop`);
}
await action();

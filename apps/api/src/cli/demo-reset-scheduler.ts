/**
 * The nightly reset of the demo, as its own long-running process: a BullMQ job scheduler
 * starts the reset every night (DEMO_RESET_CRON in DEMO_RESET_TIMEZONE). Several copies
 * share one schedule and one run; a missed night is not made up, the next comes as planned.
 */
import { Queue, Worker } from 'bullmq';
import { z } from 'zod';
import {
  beat,
  DEFAULT_HEARTBEAT_FILE,
  HEARTBEAT_INTERVAL_MS,
} from '../platform/observability/heartbeat-file.js';
import { QUEUE_PREFIX } from '../platform/queue/bullmq-job-queue.js';
import { createRedis } from '../platform/redis/redis.js';
import { systemNameOf } from '../platform/system-name.js';
import { demoResetSettingsFrom, resetDemo } from '../seed/demo-reset.js';

const QUEUE_NAME = 'demo-reset';
const SCHEDULER_ID = 'nightly-demo-reset';
/** The seed takes under a minute; the lock outlives it so no second run starts meanwhile. */
const LOCK_MS = 10 * 60_000;
const KEPT_RUNS = 30;

const settings = z
  .object({
    REDIS_URL: z.url(),
    DEMO_RESET_CRON: z.string().min(9).default('0 4 * * *'),
    DEMO_RESET_TIMEZONE: z.string().min(1).default('Europe/Moscow'),
    HEARTBEAT_FILE: z.string().min(1).default(DEFAULT_HEARTBEAT_FILE),
  })
  .parse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '')));
const reset = demoResetSettingsFrom();

const log = (message: string, fields: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ time: new Date().toISOString(), msg: message, ...fields }));
};

const connection = createRedis(settings.REDIS_URL, systemNameOf('demo-reset'));
const queue = new Queue(QUEUE_NAME, { connection, prefix: QUEUE_PREFIX });
await queue.upsertJobScheduler(
  SCHEDULER_ID,
  { pattern: settings.DEMO_RESET_CRON, tz: settings.DEMO_RESET_TIMEZONE },
  {
    name: QUEUE_NAME,
    opts: { removeOnComplete: { count: KEPT_RUNS }, removeOnFail: { count: KEPT_RUNS } },
  },
);

const worker = new Worker(
  QUEUE_NAME,
  async () => {
    log('Demo reset started');
    const seconds = await resetDemo(reset, {
      info: (message) => {
        log(message);
      },
      warn: (message) => {
        log(message, { level: 'warn' });
      },
    });
    log('Demo reset finished', { seconds: Number(seconds.toFixed(1)) });
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: 1, lockDuration: LOCK_MS },
);
worker.on('failed', (_job, error) => {
  log('Demo reset failed', { level: 'error', error: error.message });
});

const heartbeat = setInterval(() => {
  void connection
    .ping()
    .then(() => beat(settings.HEARTBEAT_FILE))
    .catch(() => undefined);
}, HEARTBEAT_INTERVAL_MS);
await beat(settings.HEARTBEAT_FILE);
log('Demo reset scheduled', {
  cron: settings.DEMO_RESET_CRON,
  timezone: settings.DEMO_RESET_TIMEZONE,
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    clearInterval(heartbeat);
    void (async () => {
      await worker.close();
      await queue.close();
      connection.disconnect();
    })();
  });
}

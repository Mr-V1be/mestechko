import { z } from 'zod';
import { createDatabase } from '../platform/db/database.js';
import { SystemClock, UuidV7Generator } from '../platform/system-clock.js';
import { runSeed, type SeedLogger } from './run-seed.js';

const SEED_POOL_SIZE = 4;

const settingsSchema = z.object({
  DATABASE_ADMIN_URL: z.url(),
  ISDAYOFF_BASE_URL: z.url().default('https://isdayoff.ru'),
  EXTERNAL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});

export interface DemoResetSettings {
  /** The owner's connection: the demo is rewritten across tenants, past row security. */
  readonly adminUrl: string;
  readonly calendar: { readonly baseUrl: string; readonly timeoutMs: number };
}

/** Settings from the environment; empty variables count as unset. */
export function demoResetSettingsFrom(source: NodeJS.ProcessEnv = process.env): DemoResetSettings {
  const parsed = settingsSchema.safeParse(
    Object.fromEntries(Object.entries(source).filter(([, value]) => value !== '')),
  );
  if (!parsed.success) {
    throw new Error('DATABASE_ADMIN_URL must be set to reset the demo (run `pnpm env:init`).');
  }
  return {
    adminUrl: parsed.data.DATABASE_ADMIN_URL,
    calendar: {
      baseUrl: parsed.data.ISDAYOFF_BASE_URL,
      timeoutMs: parsed.data.EXTERNAL_HTTP_TIMEOUT_MS,
    },
  };
}

/**
 * Puts the demo businesses back to their seeded state, with history and plans dated
 * from today. Real businesses are never touched. Returns how long it took, in seconds.
 */
export async function resetDemo(settings: DemoResetSettings, logger: SeedLogger): Promise<number> {
  const db = createDatabase({
    url: settings.adminUrl,
    poolMax: SEED_POOL_SIZE,
    applicationName: 'mestechko-seed',
  });
  const started = performance.now();
  try {
    await runSeed({
      db,
      ids: new UuidV7Generator(),
      clock: new SystemClock(),
      calendarSource: settings.calendar,
      logger,
    });
  } finally {
    await db.destroy();
  }
  return (performance.now() - started) / 1000;
}

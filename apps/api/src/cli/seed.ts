import { z } from 'zod';
import { createDatabase } from '../platform/db/database.js';
import { SystemClock, UuidV7Generator } from '../platform/system-clock.js';
import { runSeed } from '../seed/run-seed.js';
import { adminEnvironmentFrom } from './admin-database.js';

const environment = adminEnvironmentFrom();
const calendar = z
  .object({
    ISDAYOFF_BASE_URL: z.url().default('https://isdayoff.ru'),
    EXTERNAL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  })
  .parse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '')));

const db = createDatabase({
  url: environment.DATABASE_ADMIN_URL,
  poolMax: 4,
  applicationName: 'mestechko-seed',
});
const started = performance.now();
try {
  await runSeed({
    db,
    ids: new UuidV7Generator(),
    clock: new SystemClock(),
    calendarSource: {
      baseUrl: calendar.ISDAYOFF_BASE_URL,
      timeoutMs: calendar.EXTERNAL_HTTP_TIMEOUT_MS,
    },
    logger: {
      info: (message) => {
        console.log(message);
      },
      warn: (message) => {
        console.warn(message);
      },
    },
  });
  console.log(`Demo data is ready in ${((performance.now() - started) / 1000).toFixed(1)} s.`);
} finally {
  await db.destroy();
}

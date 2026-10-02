import { calendarYear, Temporal, type CalendarDayKind } from '@mestechko/domain';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  productionCalendarSyncJob,
  SyncProductionCalendar,
} from '../../src/modules/scheduling/application/production-calendar-jobs.js';
import { KyselyProductionCalendarStore } from '../../src/modules/scheduling/infrastructure/kysely-production-calendar-store.js';
import { BullMqJobQueue, QUEUE_PREFIX } from '../../src/platform/queue/bullmq-job-queue.js';
import { createRedis } from '../../src/platform/redis/redis.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const TEST_REDIS_DB = '14';
const YEAR = 2031;

function year(holiday: CalendarDayKind) {
  return calendarYear(
    YEAR,
    Array.from({ length: 365 }, (_, index) => (index === 0 ? holiday : 'working')),
  );
}

describe('production calendar synchronisation', () => {
  let databases: TestDatabases;

  beforeAll(() => {
    databases = openTestDatabases();
  });

  afterAll(async () => {
    await databases.destroy();
  });

  it('bumps the revision only when the official calendar changes', async () => {
    const store = new KyselyProductionCalendarStore(databases.unitOfWork);
    let served = year('public_holiday');
    const sync = new SyncProductionCalendar(
      { name: 'fake', fetchYear: () => Promise.resolve(served) },
      store,
      { now: () => Temporal.Now.instant() },
    );
    await sync.handle({ countryCode: 'KZ', year: YEAR });
    await sync.handle({ countryCode: 'KZ', year: YEAR });
    expect((await store.load('KZ', [YEAR]))[0]?.revision).toBe(1);
    served = year('non_working');
    await sync.handle({ countryCode: 'KZ', year: YEAR });
    const [stored] = await store.load('KZ', [YEAR]);
    expect(stored?.revision).toBe(2);
    expect(stored?.days[0]).toBe('non_working');
  });

  it('collapses repeated requests for the same year into one pending job', async () => {
    const url = new URL(process.env.REDIS_URL ?? '');
    url.pathname = `/${TEST_REDIS_DB}`;
    const redis = createRedis(url.toString(), 'mestechko-test');
    const jobs = new BullMqJobQueue(redis);
    const inspector = new Queue(productionCalendarSyncJob.name, {
      connection: redis,
      prefix: QUEUE_PREFIX,
    });
    try {
      await inspector.obliterate({ force: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await jobs.enqueue(
          productionCalendarSyncJob,
          { countryCode: 'KZ', year: YEAR },
          { deduplicationKey: 'calendar-KZ-2031' },
        );
      }
      await jobs.enqueue(
        productionCalendarSyncJob,
        { countryCode: 'KZ', year: YEAR + 1 },
        { deduplicationKey: 'calendar-KZ-2032' },
      );
      expect(await inspector.getWaitingCount()).toBe(2);
      await expect(
        jobs.enqueue(
          productionCalendarSyncJob,
          { countryCode: 'kz', year: YEAR },
          { deduplicationKey: 'x' },
        ),
      ).rejects.toThrow();
    } finally {
      await inspector.obliterate({ force: true });
      await inspector.close();
      await jobs.close();
      redis.disconnect();
    }
  });
});

import {
  datesBetween,
  localDateOf,
  verticalRegistry,
  YearlyProductionCalendar,
  type CalendarYear,
  type Clock,
} from '@mestechko/domain';
import { createI18n } from '@mestechko/i18n';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../platform/db/database.js';
import { KyselyUnitOfWork } from '../platform/db/kysely-unit-of-work.js';
import { ScryptPasswordHasher } from '../modules/identity/infrastructure/crypto-adapters.js';
import { IsDayOffCalendarSource } from '../modules/scheduling/infrastructure/isdayoff-calendar-source.js';
import { KyselyProductionCalendarStore } from '../modules/scheduling/infrastructure/kysely-production-calendar-store.js';
import type { IdGenerator } from '../shared/application/ports.js';
import { buildCatalog } from './catalog-builder.js';
import { DEMO_PASSWORD, demoBusinesses } from './definitions/index.js';
import { generateHistory } from './history-generator.js';
import { generatePeople } from './people.js';
import { Random } from './random.js';
import { writeDemoBusiness } from './seed-writer.js';

const HISTORY_DAYS = 56;
const FUTURE_DAYS = 21;
const CLIENTS_PER_BUSINESS = 360;
const COUNTRY_CODE = 'RU';

export interface SeedLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface SeedDependencies {
  readonly db: Kysely<Database>;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly calendarSource: { readonly baseUrl: string; readonly timeoutMs: number };
  readonly logger: SeedLogger;
}

/**
 * Removes demo tenants, their owners and customers known only to them. Booking history
 * protects staff and services from deletion, so bookings go first.
 */
async function removeDemoData(db: Kysely<Database>): Promise<void> {
  const emails = demoBusinesses.map((business) => business.owner.email);
  await sql`
    delete from customers c
    where exists (select 1 from clients cl join businesses b on b.id = cl.business_id
                  where cl.customer_id = c.id and b.is_demo)
      and not exists (select 1 from clients cl join businesses b on b.id = cl.business_id
                      where cl.customer_id = c.id and not b.is_demo)
  `.execute(db);
  const demoIds = db.selectFrom('businesses').select('id').where('isDemo', '=', true);
  await db.deleteFrom('bookings').where('businessId', 'in', demoIds).execute();
  await db.deleteFrom('businesses').where('isDemo', '=', true).execute();
  await db
    .deleteFrom('users')
    .where(sql<string>`lower(email)`, 'in', emails)
    .execute();
}

/** Official calendars for the seeded period; without network the seed follows schedules only. */
async function syncCalendars(
  deps: SeedDependencies,
  years: readonly number[],
): Promise<CalendarYear[]> {
  const source = new IsDayOffCalendarSource(
    deps.calendarSource.baseUrl,
    deps.calendarSource.timeoutMs,
  );
  const store = new KyselyProductionCalendarStore(new KyselyUnitOfWork(deps.db));
  for (const year of years) {
    try {
      const calendar = await source.fetchYear(COUNTRY_CODE, year);
      await store.save(
        COUNTRY_CODE,
        calendar,
        source.name,
        new Date(deps.clock.now().epochMilliseconds),
      );
    } catch (error) {
      deps.logger.warn(`Production calendar ${String(year)} unavailable: ${String(error)}`);
    }
  }
  return store.load(COUNTRY_CODE, years);
}

export async function runSeed(deps: SeedDependencies): Promise<void> {
  const i18n = await createI18n({ defaultNamespace: 'catalog' });
  const translate = (key: string): string => {
    if (!i18n.exists(key)) {
      throw new Error(`Missing translation ${key}`);
    }
    return i18n.t(key);
  };
  const now = deps.clock.now();
  const nowDate = new Date(now.epochMilliseconds);
  await removeDemoData(deps.db);

  const seedDate = localDateOf(now.epochMilliseconds, 'Europe/Moscow');
  const historyStart = seedDate.subtract({ days: HISTORY_DAYS });
  const historyEnd = seedDate.add({ days: FUTURE_DAYS });
  const years = [...new Set(datesBetween(historyStart, historyEnd).map((date) => date.year))];
  const calendar = new YearlyProductionCalendar(await syncCalendars(deps, years));
  const hasher = new ScryptPasswordHasher();
  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  const telegramIds = { next: 1 };

  for (const definition of demoBusinesses) {
    const catalog = buildCatalog({
      definition,
      vertical: verticalRegistry.get(definition.verticalId),
      ids: deps.ids,
      translate,
      seedDate,
      historyStart,
    });
    const random = new Random(`${definition.slug}:${seedDate.toString()}`);
    const people = generatePeople(random, CLIENTS_PER_BUSINESS, definition.femaleClientShare);
    const bookings = generateHistory({
      catalog,
      calendar,
      from: historyStart,
      to: historyEnd,
      now,
      random,
      clientCount: people.length,
    });
    const written = await writeDemoBusiness(deps.db, {
      catalog,
      bookings,
      people,
      ids: deps.ids,
      now: nowDate,
      telegramIds,
    });
    const userId = deps.ids.next();
    await deps.db
      .insertInto('users')
      .values({
        id: userId,
        email: definition.owner.email,
        displayName: definition.owner.displayName,
        passwordHash,
        createdAt: nowDate,
      })
      .execute();
    await deps.db
      .insertInto('memberships')
      .values({
        businessId: catalog.businessId,
        userId,
        role: 'owner',
        staffId: null,
        createdAt: nowDate,
      })
      .execute();
    deps.logger.info(
      `${definition.name} (${definition.slug}): ${String(written.bookings)} bookings, ${String(written.clients)} clients, owner ${definition.owner.email}`,
    );
  }
}

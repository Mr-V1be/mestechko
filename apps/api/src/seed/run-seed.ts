import {
  datesBetween,
  emptyProductionCalendar,
  localDateOf,
  verticalRegistry,
  YearlyProductionCalendar,
  type Clock,
  type ProductionCalendar,
} from '@mestechko/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../platform/db/database.js';
import { KyselyUnitOfWork } from '../platform/db/kysely-unit-of-work.js';
import { loadTranslations } from '../platform/i18n/i18next-translations.js';
import { ScryptPasswordHasher } from '../modules/identity/infrastructure/crypto-adapters.js';
import { IsDayOffCalendarSource } from '../modules/scheduling/infrastructure/isdayoff-calendar-source.js';
import { KyselyProductionCalendarStore } from '../modules/scheduling/infrastructure/kysely-production-calendar-store.js';
import type { IdGenerator } from '../shared/application/ports.js';
import { demoAccountEmails, demoAccountsOf, writeDemoAccounts } from './accounts.js';
import { buildCatalog } from './catalog-builder.js';
import { DEMO_PASSWORD, demoBusinesses } from './definitions/index.js';
import { generateHistory } from './history-generator.js';
import { generatePeople } from './people/index.js';
import { Random } from './random.js';
import { writeDemoBusiness } from './seed-writer.js';

/** Four months: a 30-day report compares with a full earlier month, repeat visits included. */
const HISTORY_DAYS = 120;
const FUTURE_DAYS = 21;
const CLIENTS_PER_BUSINESS = 360;

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
 * Removes demo tenants, their accounts and customers known only to them. Booking history
 * protects staff and services from deletion, so bookings go first, taking their payments
 * and ledger entries with them.
 */
async function removeDemoData(db: Kysely<Database>): Promise<void> {
  const emails = demoAccountEmails(demoBusinesses);
  await sql`
    delete from customers c
    where exists (select 1 from clients cl join businesses b on b.id = cl.business_id
                  where cl.customer_id = c.id and b.is_demo)
      and not exists (select 1 from clients cl join businesses b on b.id = cl.business_id
                      where cl.customer_id = c.id and not b.is_demo)
  `.execute(db);
  // The emulators only ever hold demo chats and payments.
  await db.deleteFrom('maxEmulatorUpdates').execute();
  await db.deleteFrom('maxEmulatorUsers').execute();
  await db.deleteFrom('testPayPayments').execute();
  const demoIds = db.selectFrom('businesses').select('id').where('isDemo', '=', true);
  await db.deleteFrom('bookings').where('businessId', 'in', demoIds).execute();
  await db.deleteFrom('businesses').where('isDemo', '=', true).execute();
  await db
    .deleteFrom('users')
    .where(sql<string>`lower(email)`, 'in', emails)
    .execute();
}

/**
 * The country's official calendar for the seeded period. Without network, or where the
 * country has none, the business follows its schedules only.
 */
async function calendarOf(
  deps: SeedDependencies,
  countryCode: string,
  years: readonly number[],
): Promise<ProductionCalendar> {
  const source = new IsDayOffCalendarSource(
    deps.calendarSource.baseUrl,
    deps.calendarSource.timeoutMs,
  );
  if (!source.covers(countryCode)) {
    return emptyProductionCalendar;
  }
  const store = new KyselyProductionCalendarStore(new KyselyUnitOfWork(deps.db));
  for (const year of years) {
    try {
      const calendar = await source.fetchYear(countryCode, year);
      await store.save(
        countryCode,
        calendar,
        source.name,
        new Date(deps.clock.now().epochMilliseconds),
      );
    } catch (error) {
      deps.logger.warn(
        `Production calendar ${countryCode} ${String(year)} unavailable: ${String(error)}`,
      );
    }
  }
  return new YearlyProductionCalendar(await store.load(countryCode, years));
}

export async function runSeed(deps: SeedDependencies): Promise<void> {
  const translations = await loadTranslations();
  const now = deps.clock.now();
  const nowDate = new Date(now.epochMilliseconds);
  await removeDemoData(deps.db);

  const hasher = new ScryptPasswordHasher();
  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  const messengerIds = { telegram: 1, max: 1 };
  const calendars = new Map<string, ProductionCalendar>();

  for (const definition of demoBusinesses) {
    const home = definition.locations[0];
    if (!home) {
      throw new Error(`${definition.slug} has no location`);
    }
    // "Today" of a business is the date at its main location.
    const seedDate = localDateOf(now.epochMilliseconds, home.timeZone);
    const historyStart = seedDate.subtract({ days: HISTORY_DAYS });
    const historyEnd = seedDate.add({ days: FUTURE_DAYS });
    const years = [...new Set(datesBetween(historyStart, historyEnd).map((date) => date.year))];
    const calendarKey = `${definition.countryCode}:${years.join(',')}`;
    const calendar =
      calendars.get(calendarKey) ?? (await calendarOf(deps, definition.countryCode, years));
    calendars.set(calendarKey, calendar);
    const catalogTexts = translations.in(definition.locale, 'catalog');
    const catalog = buildCatalog({
      definition,
      vertical: verticalRegistry.get(definition.verticalId),
      ids: deps.ids,
      translate: (key) => catalogTexts.text(key),
      seedDate,
      historyStart,
    });
    const random = new Random(`${definition.slug}:${seedDate.toString()}`);
    const people = generatePeople(random, CLIENTS_PER_BUSINESS, {
      femaleShare: definition.femaleClientShare,
      locale: definition.locale,
      countryCode: definition.countryCode,
    });
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
      messengerIds,
    });
    const accounts = demoAccountsOf(definition, catalog);
    await writeDemoAccounts(deps.db, {
      businessId: catalog.businessId,
      accounts,
      passwordHash,
      ids: deps.ids,
      now: nowDate,
    });
    deps.logger.info(
      `${definition.name} (${definition.slug}): ${String(written.bookings)} bookings, ${String(written.clients)} clients (${String(written.maxClients)} on MAX, ${String(written.notifications)} messages planned), accounts ${accounts.map((account) => account.email).join(', ')}`,
    );
  }
}

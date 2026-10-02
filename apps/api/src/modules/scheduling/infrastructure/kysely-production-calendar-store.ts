import { calendarYear, type CalendarDayKind, type CalendarYear } from '@mestechko/domain';
import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { ProductionCalendarStore, StoredCalendarYear } from '../application/ports.js';

/** One letter per day keeps a year in a single compact, checkable column. */
const codeByKind: Record<CalendarDayKind, string> = {
  working: 'W',
  non_working: 'N',
  public_holiday: 'H',
  pre_holiday: 'P',
};
const kindByCode = new Map(
  Object.entries(codeByKind).map(([kind, code]) => [code, kind as CalendarDayKind]),
);

function decode(code: string): CalendarDayKind {
  const kind = kindByCode.get(code);
  if (!kind) {
    throw new Error(`Unknown calendar day code "${code}"`);
  }
  return kind;
}

export class KyselyProductionCalendarStore implements ProductionCalendarStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async load(countryCode: string, years: readonly number[]): Promise<StoredCalendarYear[]> {
    if (years.length === 0) {
      return [];
    }
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('productionCalendarYears')
      .select(['year', 'dayKinds', 'revision'])
      .where('countryCode', '=', countryCode)
      .where('year', 'in', years)
      .execute();
    return rows.map((row) => ({
      ...calendarYear(row.year, row.dayKinds.split('').map(decode)),
      revision: row.revision,
    }));
  }

  async save(
    countryCode: string,
    year: CalendarYear,
    source: string,
    fetchedAt: Date,
  ): Promise<void> {
    const dayKinds = year.days.map((kind) => codeByKind[kind]).join('');
    await this.unitOfWork
      .platform()
      .insertInto('productionCalendarYears')
      .values({ countryCode, year: year.year, dayKinds, source, revision: 1, fetchedAt })
      .onConflict((conflict) =>
        conflict.columns(['countryCode', 'year']).doUpdateSet({
          dayKinds: (eb) => eb.ref('excluded.dayKinds'),
          source: (eb) => eb.ref('excluded.source'),
          fetchedAt: (eb) => eb.ref('excluded.fetchedAt'),
          revision: sql<number>`case when production_calendar_years.day_kinds = excluded.day_kinds
            then production_calendar_years.revision else production_calendar_years.revision + 1 end`,
        }),
      )
      .execute();
  }
}

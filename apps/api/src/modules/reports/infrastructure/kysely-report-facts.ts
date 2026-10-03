import { bookedStatuses } from '@mestechko/domain';
import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  DailyRevenue,
  DailyVisitFacts,
  ReportFactsSource,
  ReportFilter,
  ReportWindow,
} from '../application/ports.js';

const MINUTE_SECONDS = 60;

/**
 * Local date of a timestamp column. The zone is inlined as a literal, so the same
 * expression in SELECT and GROUP BY is recognised as one.
 */
const localDay = (column: 'b.starts_at' | 'e.created_at', timeZone: string) =>
  sql<string>`(${sql.ref(column)} at time zone ${sql.lit(timeZone)})::date::text`;

export class KyselyReportFacts implements ReportFactsSource {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async visits(window: ReportWindow, filter: ReportFilter): Promise<DailyVisitFacts[]> {
    const day = localDay('b.starts_at', window.timeZone);
    let query = this.unitOfWork
      .tenant()
      .selectFrom('bookings as b')
      .select((eb) => [
        day.as('date'),
        'b.staffId',
        sql<string>`coalesce(sum(extract(epoch from b.ends_at - b.starts_at)), 0)`.as('seconds'),
        eb.fn.countAll<string>().filterWhere('b.status', '=', 'completed').as('visits'),
        eb.fn.countAll<string>().filterWhere('b.status', '=', 'no_show').as('noShows'),
        eb.fn
          .countAll<string>()
          .filterWhere((inner) =>
            inner.and([
              inner('b.status', '=', 'completed'),
              inner.exists(
                inner
                  .selectFrom('bookings as p')
                  .select('p.id')
                  .whereRef('p.clientId', '=', 'b.clientId')
                  .where('p.status', '=', 'completed')
                  .whereRef('p.startsAt', '<', 'b.startsAt'),
              ),
            ]),
          )
          .as('repeatVisits'),
      ])
      .where('b.status', 'in', bookedStatuses)
      .where('b.startsAt', '>=', window.start)
      .where('b.startsAt', '<', window.end)
      .groupBy([day, 'b.staffId']);
    if (filter.staffId) {
      query = query.where('b.staffId', '=', filter.staffId);
    }
    if (filter.locationId) {
      query = query.where('b.locationId', '=', filter.locationId);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      date: row.date,
      staffId: row.staffId,
      bookedMinutes: Math.round(Number(row.seconds) / MINUTE_SECONDS),
      visits: Number(row.visits),
      noShows: Number(row.noShows),
      repeatVisits: Number(row.repeatVisits),
    }));
  }

  async revenue(window: ReportWindow, filter: ReportFilter): Promise<DailyRevenue[]> {
    const day = localDay('e.created_at', window.timeZone);
    let query = this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries as e')
      .leftJoin('bookings as b', 'b.id', 'e.bookingId')
      .select((eb) => [day.as('date'), 'b.staffId', eb.fn.sum<string>('e.amount').as('total')])
      .where('e.account', '=', 'money')
      .where('e.createdAt', '>=', window.start)
      .where('e.createdAt', '<', window.end)
      .groupBy([day, 'b.staffId']);
    if (filter.staffId) {
      query = query.where('b.staffId', '=', filter.staffId);
    }
    if (filter.locationId) {
      query = query.where('b.locationId', '=', filter.locationId);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      date: row.date,
      staffId: row.staffId,
      amountMinor: Number(row.total),
    }));
  }

  async firstRecord(timeZone: string): Promise<string | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('bookings as b')
      .select(
        sql<string | null>`(min(b.starts_at) at time zone ${sql.lit(timeZone)})::date::text`.as(
          'date',
        ),
      )
      .executeTakeFirst();
    return row?.date ?? null;
  }
}

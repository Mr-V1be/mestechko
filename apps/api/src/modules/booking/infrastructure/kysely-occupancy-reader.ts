import { timeOccupyingStatuses, type InstantInterval, type Occupancy } from '@slotwise/domain';
import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { OccupancyReader } from '../application/ports.js';

/** Overlap lookups use the GiST indexes behind the exclusion constraints. */
export class KyselyOccupancyReader implements OccupancyReader {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async load(
    staffIds: readonly string[],
    resourceIds: readonly string[],
    window: InstantInterval,
    excludeBookingId: string | null,
  ): Promise<{ staff: Occupancy[]; resources: Occupancy[] }> {
    if (staffIds.length === 0 && resourceIds.length === 0) {
      return { staff: [], resources: [] };
    }
    const range = sql`tstzrange(${new Date(window.start)}, ${new Date(window.end)}, '[)')`;
    let query = this.unitOfWork
      .tenant()
      .selectFrom('bookingItems')
      .select([
        'staffId',
        'resourceId',
        sql<Date>`lower(occupied)`.as('start'),
        sql<Date>`upper(occupied)`.as('end'),
      ])
      .where('status', 'in', timeOccupyingStatuses)
      .where(sql<boolean>`occupied && ${range}`)
      .where((eb) =>
        eb.or([
          ...(staffIds.length > 0 ? [eb('staffId', 'in', staffIds)] : []),
          ...(resourceIds.length > 0 ? [eb('resourceId', 'in', resourceIds)] : []),
        ]),
      );
    if (excludeBookingId) {
      query = query.where('bookingId', '!=', excludeBookingId);
    }
    const rows = await query.execute();
    const staffSet = new Set(staffIds);
    const toInterval = (row: { start: Date; end: Date }): InstantInterval => ({
      start: row.start.getTime(),
      end: row.end.getTime(),
    });
    return {
      staff: rows
        .filter((row) => staffSet.has(row.staffId))
        .map((row) => ({ subjectId: row.staffId, interval: toInterval(row) })),
      resources: rows.flatMap((row) =>
        row.resourceId ? [{ subjectId: row.resourceId, interval: toInterval(row) }] : [],
      ),
    };
  }
}

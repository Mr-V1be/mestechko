import { sql } from 'kysely';
import { DomainError, type PlainDate, type ScheduleChange } from '@mestechko/domain';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { isExclusionViolation } from '../../../platform/db/pg-errors.js';
import type { ScheduleStore, StaffScheduleSnapshot } from '../application/ports.js';
import type { KyselyWorkCalendarReader } from './kysely-work-calendar-reader.js';
import { dayRows, patternRows } from './schedule-rows.js';

/** Far enough ahead to cover every booking a business can take. */
const LOOKAHEAD_DAYS = 3 * 366;

export class KyselyScheduleStore implements ScheduleStore {
  constructor(
    private readonly unitOfWork: KyselyUnitOfWork,
    private readonly reader: KyselyWorkCalendarReader,
    private readonly ids: IdGenerator,
  ) {}

  async lockStaff(staffId: string): Promise<void> {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`schedule:${staffId}`}, 0))`.execute(
      this.unitOfWork.tenant(),
    );
  }

  snapshots(
    staffIds: readonly string[],
    from: PlainDate,
  ): Promise<Map<string, StaffScheduleSnapshot>> {
    return this.reader.identified(staffIds, { from, to: from.add({ days: LOOKAHEAD_DAYS }) });
  }

  async save(staffId: string, change: ScheduleChange, now: Date): Promise<void> {
    try {
      await this.write(staffId, change, now);
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new DomainError('invalid_schedule', 'The change overlaps another one');
      }
      throw error;
    }
  }

  private async write(staffId: string, change: ScheduleChange, now: Date): Promise<void> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    switch (change.kind) {
      case 'pattern': {
        const from = change.validFrom.toString();
        await db
          .deleteFrom('staffSchedules')
          .where('staffId', '=', staffId)
          .where('validFrom', '>=', from)
          .execute();
        await db
          .updateTable('staffSchedules')
          .set({ validUntil: change.validFrom.subtract({ days: 1 }).toString() })
          .where('staffId', '=', staffId)
          .where((eb) => eb.or([eb('validUntil', 'is', null), eb('validUntil', '>=', from)]))
          .execute();
        const rows = patternRows(change.pattern);
        const scheduleId = this.ids.next();
        await db
          .insertInto('staffSchedules')
          .values({
            id: scheduleId,
            businessId,
            staffId,
            locationId: change.locationId,
            patternKind: rows.patternKind,
            cycleLengthDays: rows.cycleLengthDays,
            anchorDate: rows.anchorDate,
            validFrom: from,
            validUntil: null,
            createdAt: now,
          })
          .execute();
        if (rows.intervals.length > 0) {
          await db
            .insertInto('staffScheduleIntervals')
            .values(rows.intervals.map((row) => ({ ...row, businessId, scheduleId })))
            .execute();
        }
        return;
      }
      case 'day': {
        const onDate = change.date.toString();
        await db
          .deleteFrom('staffScheduleOverrides')
          .where('staffId', '=', staffId)
          .where('onDate', '=', onDate)
          .execute();
        if (change.day.kind === 'regular') {
          return;
        }
        const overrideId = this.ids.next();
        await db
          .insertInto('staffScheduleOverrides')
          .values({
            id: overrideId,
            businessId,
            staffId,
            onDate,
            locationId: change.day.kind === 'work' ? change.day.locationId : null,
            createdAt: now,
          })
          .execute();
        const intervals = change.day.kind === 'work' ? dayRows(change.day.template, 0) : [];
        if (intervals.length > 0) {
          await db
            .insertInto('staffOverrideIntervals')
            .values(
              intervals.map(({ dayIndex: _ignored, ...row }) => ({
                ...row,
                businessId,
                overrideId,
              })),
            )
            .execute();
        }
        return;
      }
      case 'absence':
        await db
          .insertInto('staffAbsences')
          .values({
            id: this.ids.next(),
            businessId,
            staffId,
            kind: change.absence.kind,
            startsOn: change.absence.from.toString(),
            endsOn: change.absence.to.toString(),
            createdAt: now,
          })
          .execute();
        return;
      case 'absence_removal':
        await db
          .deleteFrom('staffAbsences')
          .where('staffId', '=', staffId)
          .where('startsOn', '=', change.absence.from.toString())
          .where('endsOn', '=', change.absence.to.toString())
          .execute();
        return;
    }
  }
}

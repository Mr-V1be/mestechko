import {
  dayTemplate,
  Temporal,
  wallInterval,
  type DayTemplate,
  type ScheduleAssignment,
  type ScheduleOverride,
  type SchedulePattern,
  type StaffAbsence,
  type StaffWorkCalendar,
  type WallInterval,
} from '@mestechko/domain';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { DateWindow, WorkCalendarReader } from '../application/ports.js';

interface IntervalRow {
  readonly ownerId: string;
  readonly dayIndex: number;
  readonly kind: 'work' | 'break';
  readonly startMinute: number;
  readonly endMinute: number;
}

interface DayIntervals {
  work: WallInterval[];
  breaks: WallInterval[];
}

type IntervalsByDay = Map<number, DayIntervals>;

const listByKind: Record<IntervalRow['kind'], keyof DayIntervals> = {
  work: 'work',
  break: 'breaks',
};

function groupIntervals(rows: readonly IntervalRow[]): Map<string, IntervalsByDay> {
  const grouped = new Map<string, IntervalsByDay>();
  for (const row of rows) {
    const days: IntervalsByDay = grouped.get(row.ownerId) ?? new Map<number, DayIntervals>();
    const day = days.get(row.dayIndex) ?? { work: [], breaks: [] };
    day[listByKind[row.kind]].push(wallInterval(row.startMinute, row.endMinute));
    days.set(row.dayIndex, day);
    grouped.set(row.ownerId, days);
  }
  return grouped;
}

function templateOf(days: IntervalsByDay | undefined, index: number): DayTemplate | null {
  const day = days?.get(index);
  return day && day.work.length > 0 ? dayTemplate(day.work, day.breaks) : null;
}

const DAYS_PER_WEEK = 7;

const patternBuilders: Record<
  'weekly' | 'cycle',
  (
    row: { cycleLengthDays: number; anchorDate: string | null },
    days: IntervalsByDay | undefined,
  ) => SchedulePattern
> = {
  weekly: (_row, days) => ({
    kind: 'weekly',
    week: Array.from({ length: DAYS_PER_WEEK }, (_, index) => templateOf(days, index)),
  }),
  cycle: (row, days) => ({
    kind: 'cycle',
    anchorDate: Temporal.PlainDate.from(row.anchorDate ?? ''),
    days: Array.from({ length: row.cycleLengthDays }, (_, index) => templateOf(days, index)),
  }),
};

/** A work calendar whose assignments and absences keep their stored ids. */
export interface IdentifiedWorkCalendar extends StaffWorkCalendar {
  readonly assignments: (ScheduleAssignment & { readonly id: string })[];
  readonly overrides: ScheduleOverride[];
  readonly absences: (StaffAbsence & { readonly id: string })[];
}

export class KyselyWorkCalendarReader implements WorkCalendarReader {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  forStaff(
    staffIds: readonly string[],
    window: DateWindow,
  ): Promise<Map<string, StaffWorkCalendar>> {
    return this.identified(staffIds, window);
  }

  async identified(
    staffIds: readonly string[],
    window: DateWindow,
  ): Promise<Map<string, IdentifiedWorkCalendar>> {
    const calendars = new Map<string, IdentifiedWorkCalendar>(
      staffIds.map((id) => [id, { assignments: [], overrides: [], absences: [] }]),
    );
    if (staffIds.length === 0) {
      return calendars;
    }
    const db = this.unitOfWork.tenant();
    const from = window.from.toString();
    const to = window.to.toString();

    const schedules = await db
      .selectFrom('staffSchedules')
      .select([
        'id',
        'staffId',
        'locationId',
        'patternKind',
        'cycleLengthDays',
        'anchorDate',
        'validFrom',
        'validUntil',
      ])
      .where('staffId', 'in', staffIds)
      .where('validFrom', '<=', to)
      .where((eb) => eb.or([eb('validUntil', 'is', null), eb('validUntil', '>=', from)]))
      .execute();
    const overrides = await db
      .selectFrom('staffScheduleOverrides')
      .select(['id', 'staffId', 'locationId', 'onDate'])
      .where('staffId', 'in', staffIds)
      .where('onDate', '>=', from)
      .where('onDate', '<=', to)
      .execute();
    const absences = await db
      .selectFrom('staffAbsences')
      .select(['id', 'staffId', 'kind', 'startsOn', 'endsOn'])
      .where('staffId', 'in', staffIds)
      .where('startsOn', '<=', to)
      .where('endsOn', '>=', from)
      .execute();

    const [scheduleIntervals, overrideIntervals] = await Promise.all([
      schedules.length === 0
        ? []
        : db
            .selectFrom('staffScheduleIntervals')
            .select(['scheduleId as ownerId', 'dayIndex', 'kind', 'startMinute', 'endMinute'])
            .where(
              'scheduleId',
              'in',
              schedules.map((schedule) => schedule.id),
            )
            .execute(),
      overrides.length === 0
        ? []
        : db
            .selectFrom('staffOverrideIntervals')
            .select(['overrideId as ownerId', 'kind', 'startMinute', 'endMinute'])
            .select((eb) => eb.lit(0).as('dayIndex'))
            .where(
              'overrideId',
              'in',
              overrides.map((override) => override.id),
            )
            .execute(),
    ]);
    const scheduleDays = groupIntervals(scheduleIntervals);
    const overrideDays = groupIntervals(overrideIntervals);

    for (const schedule of schedules) {
      calendars.get(schedule.staffId)?.assignments.push({
        id: schedule.id,
        locationId: schedule.locationId,
        pattern: patternBuilders[schedule.patternKind](schedule, scheduleDays.get(schedule.id)),
        validFrom: Temporal.PlainDate.from(schedule.validFrom),
        validUntil: schedule.validUntil ? Temporal.PlainDate.from(schedule.validUntil) : null,
      });
    }
    for (const override of overrides) {
      calendars.get(override.staffId)?.overrides.push({
        date: Temporal.PlainDate.from(override.onDate),
        locationId: override.locationId,
        template: templateOf(overrideDays.get(override.id), 0),
      });
    }
    for (const absence of absences) {
      calendars.get(absence.staffId)?.absences.push({
        id: absence.id,
        from: Temporal.PlainDate.from(absence.startsOn),
        to: Temporal.PlainDate.from(absence.endsOn),
        kind: absence.kind,
      });
    }
    return calendars;
  }

  async staffAssignedTo(locationId: string, window: DateWindow): Promise<Set<string>> {
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('staffSchedules')
      .select('staffId')
      .distinct()
      .where('locationId', '=', locationId)
      .where('validFrom', '<=', window.to.toString())
      .where((eb) =>
        eb.or([eb('validUntil', 'is', null), eb('validUntil', '>=', window.from.toString())]),
      )
      .execute();
    return new Set(rows.map((row) => row.staffId));
  }
}

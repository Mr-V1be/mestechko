import { applyCalendarPolicy, type CalendarPolicy } from '../calendar/calendar-policy.js';
import type { ProductionCalendar } from '../calendar/production-calendar.js';
import { invariant } from '../shared/domain-error.js';
import { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';
import { isAbsent, type StaffAbsence } from './absences.js';
import type { DayTemplate } from './day-template.js';
import {
  isDateWithin,
  patternDayTemplate,
  validateSchedulePattern,
  type SchedulePattern,
} from './schedule-pattern.js';

/** A staff member works by `pattern` at `locationId` within the validity window. */
export interface ScheduleAssignment {
  readonly locationId: string;
  readonly pattern: SchedulePattern;
  readonly validFrom: PlainDate;
  readonly validUntil: PlainDate | null;
}

/**
 * Explicit decision for one date. It always wins over the pattern and the production
 * calendar: `template === null` is a day off, otherwise custom hours at `locationId`.
 */
export interface ScheduleOverride {
  readonly date: PlainDate;
  readonly locationId: string | null;
  readonly template: DayTemplate | null;
}

export interface StaffWorkCalendar {
  readonly assignments: readonly ScheduleAssignment[];
  readonly overrides: readonly ScheduleOverride[];
  /** Vacations, sick leave and days off: no work on these dates whatever else says. */
  readonly absences: readonly StaffAbsence[];
}

export interface CalendarContext {
  readonly calendar: ProductionCalendar;
  readonly policy: CalendarPolicy;
}

export function validateWorkCalendar(workCalendar: StaffWorkCalendar): void {
  for (const assignment of workCalendar.assignments) {
    validateSchedulePattern(assignment.pattern);
    invariant(
      assignment.validUntil === null ||
        Temporal.PlainDate.compare(assignment.validFrom, assignment.validUntil) <= 0,
      'invalid_schedule',
      'Schedule validity must not end before it starts',
    );
  }
  const overrideDates = new Set(workCalendar.overrides.map((override) => override.date.toString()));
  invariant(
    overrideDates.size === workCalendar.overrides.length,
    'invalid_schedule',
    'At most one override per date',
  );
}

/** Hours a staff member works at a location on a date, or `null` when not working there. */
export function resolveStaffDay(
  workCalendar: StaffWorkCalendar,
  date: PlainDate,
  locationId: string,
  context: CalendarContext,
): DayTemplate | null {
  if (isAbsent(workCalendar.absences, date)) {
    return null;
  }
  const override = workCalendar.overrides.find((candidate) => candidate.date.equals(date));
  if (override) {
    return override.locationId === locationId ? override.template : null;
  }
  const assignment = workCalendar.assignments.find(
    (candidate) =>
      candidate.locationId === locationId &&
      isDateWithin(date, candidate.validFrom, candidate.validUntil),
  );
  if (!assignment) {
    return null;
  }
  const template = patternDayTemplate(assignment.pattern, date);
  if (!template) {
    return null;
  }
  return applyCalendarPolicy(template, context.calendar.dayKind(date), context.policy);
}

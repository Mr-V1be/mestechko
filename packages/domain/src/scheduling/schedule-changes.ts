import { invariant } from '../shared/domain-error.js';
import { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';
import { validateAbsence, type StaffAbsence } from './absences.js';
import type { DayTemplate } from './day-template.js';
import type { SchedulePattern } from './schedule-pattern.js';
import type { ScheduleAssignment, StaffWorkCalendar } from './staff-work-calendar.js';

/** How a single date differs from the regular schedule, or goes back to it. */
export type DayChange =
  | { readonly kind: 'work'; readonly locationId: string; readonly template: DayTemplate }
  | { readonly kind: 'off' }
  | { readonly kind: 'regular' };

/** A change of someone's working time, as the business makes it. */
export type ScheduleChange =
  | {
      readonly kind: 'pattern';
      readonly locationId: string;
      readonly pattern: SchedulePattern;
      /** The new pattern applies from this date on; earlier days keep the old one. */
      readonly validFrom: PlainDate;
    }
  | { readonly kind: 'day'; readonly date: PlainDate; readonly day: DayChange }
  | { readonly kind: 'absence'; readonly absence: StaffAbsence }
  | { readonly kind: 'absence_removal'; readonly absence: StaffAbsence };

const overlaps = (a: StaffAbsence, b: StaffAbsence) =>
  Temporal.PlainDate.compare(a.from, b.to) <= 0 && Temporal.PlainDate.compare(b.from, a.to) <= 0;

function withPattern(
  assignments: readonly ScheduleAssignment[],
  next: ScheduleAssignment,
): ScheduleAssignment[] {
  const dayBefore = next.validFrom.subtract({ days: 1 });
  return [
    ...assignments.flatMap((assignment): ScheduleAssignment[] => {
      if (Temporal.PlainDate.compare(assignment.validFrom, next.validFrom) >= 0) {
        return [];
      }
      const endsBefore =
        assignment.validUntil !== null &&
        Temporal.PlainDate.compare(assignment.validUntil, dayBefore) <= 0;
      return [endsBefore ? assignment : { ...assignment, validUntil: dayBefore }];
    }),
    next,
  ];
}

/**
 * The calendar after a change. Previewing a change and saving it use the same rules,
 * so what the business confirms is what takes effect.
 */
export function applyScheduleChange(
  calendar: StaffWorkCalendar,
  change: ScheduleChange,
): StaffWorkCalendar {
  switch (change.kind) {
    case 'pattern':
      return {
        ...calendar,
        assignments: withPattern(calendar.assignments, {
          locationId: change.locationId,
          pattern: change.pattern,
          validFrom: change.validFrom,
          validUntil: null,
        }),
      };
    case 'day': {
      const overrides = calendar.overrides.filter((override) => !override.date.equals(change.date));
      const { day } = change;
      if (day.kind === 'regular') {
        return { ...calendar, overrides };
      }
      return {
        ...calendar,
        overrides: [
          ...overrides,
          day.kind === 'work'
            ? { date: change.date, locationId: day.locationId, template: day.template }
            : { date: change.date, locationId: null, template: null },
        ],
      };
    }
    case 'absence':
      validateAbsence(change.absence);
      invariant(
        !calendar.absences.some((absence) => overlaps(absence, change.absence)),
        'invalid_schedule',
        'The person is already away on some of these days',
      );
      return { ...calendar, absences: [...calendar.absences, change.absence] };
    case 'absence_removal':
      return {
        ...calendar,
        absences: calendar.absences.filter(
          (absence) =>
            !(absence.from.equals(change.absence.from) && absence.to.equals(change.absence.to)),
        ),
      };
  }
}

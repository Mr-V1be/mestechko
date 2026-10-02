import type {
  DayHours,
  PatternInput,
  ScheduleChange as ScheduleChangeInput,
  SchedulePatternView,
  StaffAbsenceView,
  StaffAssignmentView,
  StaffDayException,
} from '@mestechko/contracts';
import {
  dayTemplate,
  formatWallTime,
  parseWallInterval,
  patternFromTemplate,
  Temporal,
  validateSchedulePattern,
  type DayTemplate,
  type ScheduleChange,
  type SchedulePattern,
  type WallInterval,
} from '@mestechko/domain';
import { notFound } from '../../../shared/application/application-error.js';
import type { StaffScheduleSnapshot } from '../../scheduling/application/ports.js';

const toRange = (interval: WallInterval) => ({
  start: formatWallTime(interval.start),
  end: formatWallTime(interval.end),
});

/** Hours of a day as the cabinet sets them: one span with breaks inside. */
export function toTemplate(hours: DayHours): DayTemplate {
  return dayTemplate(
    [parseWallInterval(hours.start, hours.end)],
    hours.breaks.map((pause) => parseWallInterval(pause.start, pause.end)),
  );
}

/** A day as the cabinet shows it; gaps between work intervals read as breaks. */
export function toHours(template: DayTemplate): DayHours {
  const work = [...template.work].sort((a, b) => a.start - b.start);
  const first = work[0];
  const last = work.at(-1);
  if (!first || !last) {
    throw new Error('A working day without work intervals');
  }
  const gaps = work.slice(1).map((interval, index) => ({
    start: work[index]?.end ?? interval.start,
    end: interval.start,
  }));
  return {
    start: formatWallTime(first.start),
    end: formatWallTime(last.end),
    breaks: [...gaps, ...template.breaks].sort((a, b) => a.start - b.start).map(toRange),
  };
}

export function toPattern(input: PatternInput): SchedulePattern {
  const day = (hours: DayHours | null) => (hours ? toTemplate(hours) : null);
  const pattern: SchedulePattern =
    input.kind === 'template'
      ? patternFromTemplate(input.template, {
          hours: toTemplate(input.hours),
          weekdays: input.weekdays,
          anchorDate: Temporal.PlainDate.from(input.anchorDate),
        })
      : input.kind === 'weekly'
        ? { kind: 'weekly', week: input.days.map(day) }
        : {
            kind: 'cycle',
            anchorDate: Temporal.PlainDate.from(input.anchorDate),
            days: input.days.map(day),
          };
  validateSchedulePattern(pattern);
  return pattern;
}

export function patternView(pattern: SchedulePattern): SchedulePatternView {
  const day = (template: DayTemplate | null) => (template ? toHours(template) : null);
  return pattern.kind === 'weekly'
    ? { kind: 'weekly', days: pattern.week.map(day) }
    : { kind: 'cycle', anchorDate: pattern.anchorDate.toString(), days: pattern.days.map(day) };
}

/** The domain change a cabinet request describes. */
export function toChange(
  input: ScheduleChangeInput,
  snapshot: StaffScheduleSnapshot,
): ScheduleChange {
  switch (input.type) {
    case 'pattern':
      return {
        kind: 'pattern',
        locationId: input.locationId,
        pattern: toPattern(input.pattern),
        validFrom: Temporal.PlainDate.from(input.validFrom),
      };
    case 'day':
      return {
        kind: 'day',
        date: Temporal.PlainDate.from(input.date),
        day:
          input.day.kind === 'work'
            ? {
                kind: 'work',
                locationId: input.day.locationId,
                template: toTemplate(input.day.hours),
              }
            : input.day,
      };
    case 'absence':
      return {
        kind: 'absence',
        absence: {
          kind: input.kind,
          from: Temporal.PlainDate.from(input.from),
          to: Temporal.PlainDate.from(input.to),
        },
      };
    case 'absence_removal': {
      const absence = snapshot.absences.find((candidate) => candidate.id === input.absenceId);
      if (!absence) {
        throw notFound('Absence');
      }
      return { kind: 'absence_removal', absence };
    }
  }
}

/** The first day a change touches; changes may not rewrite the past. */
export function firstDayOf(change: ScheduleChange): Temporal.PlainDate {
  switch (change.kind) {
    case 'pattern':
      return change.validFrom;
    case 'day':
      return change.date;
    case 'absence':
    case 'absence_removal':
      return change.absence.to;
  }
}

export function scheduleViews(snapshot: StaffScheduleSnapshot): {
  assignments: StaffAssignmentView[];
  exceptions: StaffDayException[];
  absences: StaffAbsenceView[];
} {
  return {
    assignments: snapshot.assignments
      .map((assignment) => ({
        id: assignment.id,
        locationId: assignment.locationId,
        pattern: patternView(assignment.pattern),
        validFrom: assignment.validFrom.toString(),
        validUntil: assignment.validUntil?.toString() ?? null,
      }))
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    exceptions: snapshot.overrides
      .map((override) => ({
        date: override.date.toString(),
        locationId: override.locationId,
        hours: override.template ? toHours(override.template) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    absences: snapshot.absences
      .map((absence) => ({
        id: absence.id,
        kind: absence.kind,
        from: absence.from.toString(),
        to: absence.to.toString(),
      }))
      .sort((a, b) => a.from.localeCompare(b.from)),
  };
}

import type { DayTemplate, SchedulePattern } from '@mestechko/domain';

export interface IntervalRow {
  readonly dayIndex: number;
  readonly kind: 'work' | 'break';
  readonly startMinute: number;
  readonly endMinute: number;
}

/** Interval rows of one day of a pattern or exception. */
export function dayRows(template: DayTemplate | null, dayIndex: number): IntervalRow[] {
  if (!template) {
    return [];
  }
  return [
    ...template.work.map((interval) => ({
      dayIndex,
      kind: 'work' as const,
      startMinute: interval.start,
      endMinute: interval.end,
    })),
    ...template.breaks.map((interval) => ({
      dayIndex,
      kind: 'break' as const,
      startMinute: interval.start,
      endMinute: interval.end,
    })),
  ];
}

/** A pattern as stored: its kind, cycle length, anchor and interval rows per day. */
export function patternRows(pattern: SchedulePattern) {
  const days = pattern.kind === 'weekly' ? pattern.week : pattern.days;
  return {
    patternKind: pattern.kind,
    cycleLengthDays: days.length,
    anchorDate: pattern.kind === 'cycle' ? pattern.anchorDate.toString() : null,
    intervals: days.flatMap((template, dayIndex) => dayRows(template, dayIndex)),
  };
}

import { invariant } from '../shared/domain-error.js';
import { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';
import type { DayTemplate } from './day-template.js';

const DAYS_PER_WEEK = 7;

/** Same hours every week; index 0 is Monday, `null` is a day off. */
export interface WeeklyPattern {
  readonly kind: 'weekly';
  readonly week: readonly (DayTemplate | null)[];
}

/**
 * Rotating shifts such as 2/2 or 5/2 anchored at a date: day `anchorDate` uses
 * `days[0]`, the next day `days[1]` and so on, wrapping around.
 */
export interface CyclePattern {
  readonly kind: 'cycle';
  readonly anchorDate: PlainDate;
  readonly days: readonly (DayTemplate | null)[];
}

interface PatternByKind {
  weekly: WeeklyPattern;
  cycle: CyclePattern;
}

export type SchedulePatternKind = keyof PatternByKind;
export type SchedulePattern = PatternByKind[SchedulePatternKind];

interface PatternStrategy<P> {
  validate(pattern: P): void;
  dayTemplate(pattern: P, date: PlainDate): DayTemplate | null;
}

const weeklyStrategy: PatternStrategy<WeeklyPattern> = {
  validate(pattern) {
    invariant(
      pattern.week.length === DAYS_PER_WEEK,
      'invalid_schedule',
      'A weekly pattern describes exactly seven days',
    );
  },
  dayTemplate(pattern, date) {
    return pattern.week[date.dayOfWeek - 1] ?? null;
  },
};

const cycleStrategy: PatternStrategy<CyclePattern> = {
  validate(pattern) {
    invariant(pattern.days.length > 0, 'invalid_schedule', 'A shift cycle needs at least one day');
    invariant(
      pattern.days.some((day) => day !== null),
      'invalid_schedule',
      'A shift cycle needs at least one working day',
    );
  },
  dayTemplate(pattern, date) {
    const offset = pattern.anchorDate.until(date, { largestUnit: 'days' }).days;
    const length = pattern.days.length;
    const index = ((offset % length) + length) % length;
    return pattern.days[index] ?? null;
  },
};

const patternStrategies: { [K in SchedulePatternKind]: PatternStrategy<PatternByKind[K]> } = {
  weekly: weeklyStrategy,
  cycle: cycleStrategy,
};

export const schedulePatternKinds = Object.keys(patternStrategies) as SchedulePatternKind[];

function strategyFor<K extends SchedulePatternKind>(
  pattern: PatternByKind[K],
): PatternStrategy<PatternByKind[K]> {
  return patternStrategies[pattern.kind as K];
}

export function validateSchedulePattern(pattern: SchedulePattern): void {
  strategyFor(pattern).validate(pattern);
}

export function patternDayTemplate(pattern: SchedulePattern, date: PlainDate): DayTemplate | null {
  return strategyFor(pattern).dayTemplate(pattern, date);
}

export function isDateWithin(date: PlainDate, from: PlainDate, until: PlainDate | null): boolean {
  return (
    Temporal.PlainDate.compare(date, from) >= 0 &&
    (until === null || Temporal.PlainDate.compare(date, until) <= 0)
  );
}

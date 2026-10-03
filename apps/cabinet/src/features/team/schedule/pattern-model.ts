import type {
  DayHours,
  PatternInput,
  ScheduleChange,
  SchedulePatternView,
  StaffAssignmentView,
} from '@mestechko/contracts/client';
import { scheduleTemplateIds, type ScheduleTemplate } from '@mestechko/domain';
import { daysBetween, isoWeekdays, laterOf, nextCycleStart } from './dates';
import { DEFAULT_HOURS, hoursAreValid, sameHours } from './hours-model';

type Day = DayHours | null;
type PatternKind = SchedulePatternView['kind'];

/** Longest shift cycle the API accepts. */
export const MAX_CYCLE_DAYS = 56;
const MIN_CYCLE_DAYS = 2;
const WORKDAYS_PER_WEEK = 5;

interface TemplateShape {
  readonly kind: PatternKind;
  /** Whether the person chooses the working weekdays. */
  readonly choosesWeekdays: boolean;
  /** The days the template repeats, built from one day's hours. */
  days(hours: DayHours, weekdays: readonly number[]): Day[];
}

const cycle = (on: number, off: number): TemplateShape => ({
  kind: 'cycle',
  choosesWeekdays: false,
  days: (hours) => [
    ...Array.from({ length: on }, () => hours),
    ...Array.from({ length: off }, () => null),
  ],
});

/**
 * How each schedule template of the domain repeats, so the editor can show the result
 * before saving and name a saved pattern. The API builds what is saved from the
 * template itself; a new template there fails to compile here until it is described.
 */
export const templateShapes: Readonly<Record<ScheduleTemplate, TemplateShape>> = {
  five_two: {
    kind: 'weekly',
    choosesWeekdays: false,
    days: (hours) => isoWeekdays.map((weekday) => (weekday <= WORKDAYS_PER_WEEK ? hours : null)),
  },
  two_two: cycle(2, 2),
  three_three: cycle(3, 3),
  weekdays: {
    kind: 'weekly',
    choosesWeekdays: true,
    days: (hours, weekdays) =>
      isoWeekdays.map((weekday) => (weekdays.includes(weekday) ? hours : null)),
  },
};

export const CUSTOM = 'custom';
export type PatternChoice = ScheduleTemplate | typeof CUSTOM;
export const patternChoices: readonly PatternChoice[] = [...scheduleTemplateIds, CUSTOM];

/** The template a saved pattern was built from, if any. */
export function templateOf(pattern: SchedulePatternView): {
  readonly template: ScheduleTemplate;
  readonly hours: DayHours;
  readonly weekdays: readonly number[];
} | null {
  const hours = pattern.days.find((day): day is DayHours => day !== null);
  if (!hours) {
    return null;
  }
  const weekdays =
    pattern.kind === 'weekly' ? isoWeekdays.filter((_, index) => pattern.days[index]) : [];
  const template = scheduleTemplateIds.find((id) => {
    const shape = templateShapes[id];
    const days = shape.days(hours, weekdays);
    return (
      shape.kind === pattern.kind &&
      days.length === pattern.days.length &&
      days.every((day, index) => sameHours(day, pattern.days[index] ?? null))
    );
  });
  return template ? { template, hours, weekdays } : null;
}

export function patternChoiceOf(pattern: SchedulePatternView): PatternChoice {
  return templateOf(pattern)?.template ?? CUSTOM;
}

/** Everything the schedule editor holds; nothing is lost when switching templates. */
export interface PatternDraft {
  readonly choice: PatternChoice;
  /** Hours of every working day of a template. */
  readonly hours: DayHours;
  readonly weekdays: readonly number[];
  readonly customKind: PatternKind;
  readonly customWeek: readonly Day[];
  readonly customCycle: readonly Day[];
  /** The schedule applies from this date; a cycle's first working day. */
  readonly startDate: string;
  readonly locationId: string;
}

const defaultWeek = (hours: DayHours) => templateShapes.five_two.days(hours, []);

/**
 * The editor opens on the schedule that applies last, so changing hours keeps the
 * rest; a cycle keeps its rhythm by starting on its next first day.
 */
export function draftFrom(
  assignment: StaffAssignmentView | undefined,
  today: string,
  fallbackLocationId: string,
): PatternDraft {
  if (!assignment) {
    return {
      choice: 'five_two',
      hours: DEFAULT_HOURS,
      weekdays: isoWeekdays.slice(0, WORKDAYS_PER_WEEK),
      customKind: 'weekly',
      customWeek: defaultWeek(DEFAULT_HOURS),
      customCycle: templateShapes.two_two.days(DEFAULT_HOURS, []),
      startDate: today,
      locationId: fallbackLocationId,
    };
  }
  const { pattern } = assignment;
  const from = laterOf(today, assignment.validFrom);
  const recognized = templateOf(pattern);
  const hours = recognized?.hours ?? pattern.days.find((day) => day !== null) ?? DEFAULT_HOURS;
  return {
    choice: recognized?.template ?? CUSTOM,
    hours,
    weekdays: recognized?.weekdays.length
      ? recognized.weekdays
      : isoWeekdays.slice(0, WORKDAYS_PER_WEEK),
    customKind: pattern.kind,
    customWeek: pattern.kind === 'weekly' ? pattern.days : defaultWeek(hours),
    customCycle: pattern.kind === 'cycle' ? pattern.days : templateShapes.two_two.days(hours, []),
    startDate:
      pattern.kind === 'cycle'
        ? nextCycleStart(pattern.anchorDate, pattern.days.length, from)
        : from,
    locationId: assignment.locationId,
  };
}

/** The pattern the draft describes, as the week view shows it. */
export function draftPattern(draft: PatternDraft): SchedulePatternView {
  if (draft.choice === CUSTOM) {
    return draft.customKind === 'weekly'
      ? { kind: 'weekly', days: [...draft.customWeek] }
      : { kind: 'cycle', anchorDate: draft.startDate, days: [...draft.customCycle] };
  }
  const shape = templateShapes[draft.choice];
  const days = shape.days(draft.hours, draft.weekdays);
  return shape.kind === 'weekly'
    ? { kind: 'weekly', days }
    : { kind: 'cycle', anchorDate: draft.startDate, days };
}

export function patternChange(draft: PatternDraft): ScheduleChange {
  const pattern: PatternInput =
    draft.choice === CUSTOM
      ? draftPattern(draft)
      : {
          kind: 'template',
          template: draft.choice,
          hours: draft.hours,
          weekdays: templateShapes[draft.choice].choosesWeekdays
            ? [...draft.weekdays].sort((a, b) => a - b)
            : [],
          anchorDate: draft.startDate,
        };
  return { type: 'pattern', locationId: draft.locationId, validFrom: draft.startDate, pattern };
}

export type DraftProblem = 'noWeekdays' | 'noWorkDays' | 'hours' | 'dateRequired' | 'pastDate';

/** What keeps the draft from being saved; hour problems are shown at their fields. */
export function draftProblems(draft: PatternDraft, today: string): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.startDate) {
    problems.push('dateRequired');
  } else if (daysBetween(today, draft.startDate) < 0) {
    problems.push('pastDate');
  }
  const { days } = draftPattern(draft);
  if (draft.choice !== CUSTOM && templateShapes[draft.choice].choosesWeekdays) {
    if (draft.weekdays.length === 0) {
      problems.push('noWeekdays');
    }
  } else if (days.every((day) => day === null)) {
    problems.push('noWorkDays');
  }
  if (days.some((day) => day !== null && !hoursAreValid(day))) {
    problems.push('hours');
  }
  return problems;
}

/** A custom cycle grows by days off at its end, or shrinks from the end. */
export function resizeCycle(days: readonly Day[], length: number): Day[] {
  const bounded = Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, length));
  return Array.from({ length: bounded }, (_, index) => days[index] ?? null);
}

export const cycleLimits = { min: MIN_CYCLE_DAYS, max: MAX_CYCLE_DAYS } as const;

import type { DayHours } from '@mestechko/contracts/client';

/** Breaks a day may have; the API accepts no more. */
export const MAX_BREAKS_PER_DAY = 4;

/** Hours a new working day starts with. */
export const DEFAULT_HOURS: DayHours = { start: '10:00', end: '19:00', breaks: [] };

/** Hours a new break starts with: the middle of the working day, half an hour. */
const DEFAULT_BREAK_MINUTES = 30;
const MINUTES_PER_HOUR = 60;

export type HoursProblem = 'required' | 'endBeforeStart' | 'breakOutside';

export interface HoursCheck {
  readonly hours: HoursProblem | null;
  readonly breaks: readonly (HoursProblem | null)[];
}

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;

function rangeProblem(range: { start: string; end: string }): HoursProblem | null {
  if (!range.start || !range.end) {
    return 'required';
  }
  return minutesOf(range.end) > minutesOf(range.start) ? null : 'endBeforeStart';
}

/** What is wrong with a day's hours, field by field; checked as people type. */
export function checkHours(day: DayHours): HoursCheck {
  const hours = rangeProblem(day);
  return {
    hours,
    breaks: day.breaks.map((pause) => {
      const problem = rangeProblem(pause);
      if (problem || hours) {
        return problem;
      }
      return minutesOf(pause.start) >= minutesOf(day.start) &&
        minutesOf(pause.end) <= minutesOf(day.end)
        ? null
        : 'breakOutside';
    }),
  };
}

export function hoursAreValid(day: DayHours): boolean {
  const check = checkHours(day);
  return check.hours === null && check.breaks.every((problem) => problem === null);
}

/**
 * Problems worth showing now: wrong values at once, empty ones only after the person
 * tried to save, so a fresh form does not greet them with errors.
 */
export function visibleProblem(
  problem: HoursProblem | null,
  attempted: boolean,
): HoursProblem | null {
  return problem === 'required' && !attempted ? null : problem;
}

/** A break in the middle of the day, so it starts valid. */
export function suggestedBreak(day: DayHours): { start: string; end: string } {
  if (rangeProblem(day)) {
    return { start: '', end: '' };
  }
  const middle = Math.floor((minutesOf(day.start) + minutesOf(day.end)) / 2 / MINUTES_PER_HOUR);
  const start = Math.max(minutesOf(day.start), middle * MINUTES_PER_HOUR);
  const end = Math.min(minutesOf(day.end), start + DEFAULT_BREAK_MINUTES);
  return { start: timeOf(start), end: timeOf(end) };
}

export function sameHours(a: DayHours | null, b: DayHours | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.breaks.length === b.breaks.length &&
    a.breaks.every(
      (pause, index) =>
        pause.start === b.breaks.at(index)?.start && pause.end === b.breaks.at(index)?.end,
    )
  );
}

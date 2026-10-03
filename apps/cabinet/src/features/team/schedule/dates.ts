import { addDays } from '../../schedule/timeline-model';

const DAY_MS = 86_400_000;

/** ISO weekdays, Monday (1) to Sunday (7): the order of a weekly pattern's days. */
export const isoWeekdays = [1, 2, 3, 4, 5, 6, 7] as const;

/** Any Monday: the dates of its week name the weekdays in the reader's language. */
const REFERENCE_MONDAY = '2024-01-01';

/** A date of the reference week falling on the ISO weekday, for naming it. */
export function weekdayDate(isoWeekday: number): string {
  return addDays(REFERENCE_MONDAY, isoWeekday - 1);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function laterOf(a: string, b: string): string {
  return a > b ? a : b;
}

/** Position of `date` in a cycle of `length` days that starts on `anchor`. */
export function cycleIndex(anchor: string, date: string, length: number): number {
  return ((daysBetween(anchor, date) % length) + length) % length;
}

/** The first date on or after `from` when the cycle starts over, keeping its rhythm. */
export function nextCycleStart(anchor: string, length: number, from: string): string {
  const index = cycleIndex(anchor, from, length);
  return index === 0 ? from : addDays(from, length - index);
}

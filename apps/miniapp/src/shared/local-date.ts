/**
 * Calendar arithmetic on `YYYY-MM-DD` strings. Dates are local to the business
 * location, so "today" and day parts are computed in its time zone, not the browser's.
 */
const MS_PER_DAY = 86_400_000;

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

export function localDateOf(instant: string, timeZone: string): string {
  return todayIn(timeZone, new Date(instant));
}

export function localHourOf(instant: string, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
  return Number(hour);
}

/** Parts of the day the slot grid is grouped by, with the hour each one starts at. */
export const dayParts = [
  { key: 'morning', fromHour: 0 },
  { key: 'afternoon', fromHour: 12 },
  { key: 'evening', fromHour: 17 },
] as const;

export type DayPart = (typeof dayParts)[number]['key'];

export function dayPartOf(hour: number): DayPart {
  return [...dayParts].reverse().find((part) => hour >= part.fromHour)?.key ?? 'morning';
}

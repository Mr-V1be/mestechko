import { invariant } from '../shared/domain-error.js';
import type { PlainDate } from '../time/zoned-time.js';

/** Official status of a day according to a country's production calendar. */
export const calendarDayKinds = [
  'working',
  'non_working',
  'public_holiday',
  'pre_holiday',
] as const;

export type CalendarDayKind = (typeof calendarDayKinds)[number];

export interface ProductionCalendar {
  /** `null` when the calendar for that date is not known (yet). */
  dayKind(date: PlainDate): CalendarDayKind | null;
}

/** Day kinds of one calendar year, indexed by day of year (January 1st is index 0). */
export interface CalendarYear {
  readonly year: number;
  readonly days: readonly CalendarDayKind[];
}

function daysInYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

export function calendarYear(year: number, days: readonly CalendarDayKind[]): CalendarYear {
  invariant(
    days.length === daysInYear(year),
    'invalid_calendar',
    `Calendar ${String(year)} must describe ${String(daysInYear(year))} days, got ${String(days.length)}`,
  );
  return { year, days };
}

export class YearlyProductionCalendar implements ProductionCalendar {
  private readonly years: ReadonlyMap<number, CalendarYear>;

  constructor(years: readonly CalendarYear[]) {
    this.years = new Map(years.map((entry) => [entry.year, entry]));
  }

  dayKind(date: PlainDate): CalendarDayKind | null {
    return this.years.get(date.year)?.days[date.dayOfYear - 1] ?? null;
  }

  coveredYears(): number[] {
    return [...this.years.keys()];
  }
}

/** Calendar for businesses that ignore official days off, and for unknown countries. */
export const emptyProductionCalendar: ProductionCalendar = {
  dayKind: () => null,
};

import { addDays, todayIn, weekStart } from '../schedule/timeline-model';

const WEEK_DAYS = 7;
/** Days ahead the upcoming period covers. */
const UPCOMING_DAYS = 60;
const MONTH_DAYS = 30;

interface PeriodDefinition {
  range(today: string): { from: string; to: string };
}

/** Periods the bookings list offers; local dates of the business. */
export const periods = {
  today: { range: (today) => ({ from: today, to: today }) },
  tomorrow: { range: (today) => ({ from: addDays(today, 1), to: addDays(today, 1) }) },
  thisWeek: {
    range: (today) => ({ from: weekStart(today), to: addDays(weekStart(today), WEEK_DAYS - 1) }),
  },
  nextWeek: {
    range: (today) => ({
      from: addDays(weekStart(today), WEEK_DAYS),
      to: addDays(weekStart(today), WEEK_DAYS * 2 - 1),
    }),
  },
  /** Everything clients can still book: the booking horizon of every vertical fits. */
  upcoming: { range: (today) => ({ from: today, to: addDays(today, UPCOMING_DAYS - 1) }) },
  lastWeek: {
    range: (today) => ({
      from: addDays(weekStart(today), -WEEK_DAYS),
      to: addDays(weekStart(today), -1),
    }),
  },
  last30: { range: (today) => ({ from: addDays(today, -MONTH_DAYS + 1), to: today }) },
} as const satisfies Record<string, PeriodDefinition>;

export type PeriodId = keyof typeof periods;
export const periodIds = Object.keys(periods) as PeriodId[];
export const defaultPeriod: PeriodId = 'thisWeek';

export function periodRange(period: PeriodId, timeZone: string): { from: string; to: string } {
  return periods[period].range(todayIn(timeZone));
}

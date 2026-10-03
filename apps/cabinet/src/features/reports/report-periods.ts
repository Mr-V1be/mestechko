import { addDays, todayIn, weekStart } from '../schedule/timeline-model';

const MONTH_DAYS = 30;
const QUARTER_MONTHS = 3;

/** First day of the month `months` away from the month of `date`. */
function monthStart(date: string, months = 0): string {
  const [year = 0, month = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

/** The same day `months` away, clamped to the length of that month (31 May − 3 → 28 Feb). */
function shiftMonths(date: string, months: number): string {
  const day = Number(date.slice(8, 10));
  const target = monthStart(date, months);
  const lastDay = Number(addDays(monthStart(date, months + 1), -1).slice(8, 10));
  return `${target.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

interface ReportPeriodDefinition {
  range(today: string): { readonly from: string; readonly to: string };
}

/**
 * Periods of the reports, in local dates of the business. Running periods end today,
 * so they compare with the same number of days before them instead of days to come.
 */
export const reportPeriods = {
  thisWeek: { range: (today) => ({ from: weekStart(today), to: today }) },
  thisMonth: { range: (today) => ({ from: monthStart(today), to: today }) },
  lastMonth: {
    range: (today) => ({ from: monthStart(today, -1), to: addDays(monthStart(today), -1) }),
  },
  last30: { range: (today) => ({ from: addDays(today, -MONTH_DAYS + 1), to: today }) },
  quarter: {
    range: (today) => ({ from: addDays(shiftMonths(today, -QUARTER_MONTHS), 1), to: today }),
  },
} as const satisfies Record<string, ReportPeriodDefinition>;

export type ReportPeriodId = keyof typeof reportPeriods;
export const reportPeriodIds = Object.keys(reportPeriods) as ReportPeriodId[];
export const defaultReportPeriod: ReportPeriodId = 'last30';

export function reportPeriodRange(
  period: ReportPeriodId,
  timeZone: string,
): { readonly from: string; readonly to: string } {
  return reportPeriods[period].range(todayIn(timeZone));
}

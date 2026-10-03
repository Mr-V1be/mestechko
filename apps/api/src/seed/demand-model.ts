import type { PlainDate, ProductionCalendar } from '@mestechko/domain';
import type { DemoDemand } from './definitions/types.js';

const MINUTES_PER_HOUR = 60;
const MORNING_END = 12 * MINUTES_PER_HOUR;
const EVENING_START = 17 * MINUTES_PER_HOUR;
/** The day before a public holiday people squeeze visits in; the day itself is quiet. */
const PRE_HOLIDAY_RUSH = 1.18;
const HOLIDAY_LULL = 0.55;
/** Missed and cancelled visits are likelier early in the morning and on Mondays. */
const MORNING_RISK = 1.45;
const MONDAY_RISK = 1.3;
const WEEKEND_RISK = 0.8;

function parseTime(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/**
 * How busy a past or coming day is relative to the business's base: the weekday, a slow
 * growth towards today and the production calendar around public holidays.
 */
export function dayDemand(input: {
  readonly demand: DemoDemand;
  readonly date: PlainDate;
  readonly historyStart: PlainDate;
  readonly today: PlainDate;
  readonly calendar: ProductionCalendar;
}): number {
  const { demand, date, historyStart, today, calendar } = input;
  const weekday = demand.weekdays[date.dayOfWeek - 1] ?? 1;
  const span = Math.max(1, historyStart.until(today, { largestUnit: 'days' }).days);
  const elapsed = Math.min(
    span,
    Math.max(0, historyStart.until(date, { largestUnit: 'days' }).days),
  );
  const trend = demand.trendStart + (1 - demand.trendStart) * (elapsed / span);
  const kind = calendar.dayKind(date);
  const nextKind = calendar.dayKind(date.add({ days: 1 }));
  const holiday =
    kind === 'public_holiday' ? HOLIDAY_LULL : nextKind === 'public_holiday' ? PRE_HOLIDAY_RUSH : 1;
  return weekday * trend * holiday;
}

/** The pull of a start time: evenings over mornings for a salon, Friday evening most. */
export function startWeight(demand: DemoDemand, weekday: number, minuteOfDay: number): number {
  const part =
    minuteOfDay < MORNING_END
      ? demand.dayParts.morning
      : minuteOfDay >= EVENING_START
        ? demand.dayParts.evening
        : demand.dayParts.day;
  const peak = (demand.peaks ?? []).find(
    (candidate) => candidate.weekday === weekday && minuteOfDay >= parseTime(candidate.from),
  );
  return part * (peak?.factor ?? 1);
}

/** How likely a visit is to be missed or cancelled, relative to the usual rate. */
export function attendanceRisk(weekday: number, minuteOfDay: number): number {
  const morning = minuteOfDay < MORNING_END ? MORNING_RISK : 1;
  const day = weekday === 1 ? MONDAY_RISK : weekday >= 6 ? WEEKEND_RISK : 1;
  return morning * day;
}

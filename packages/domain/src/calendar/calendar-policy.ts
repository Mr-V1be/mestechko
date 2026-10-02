import { invariant } from '../shared/domain-error.js';
import { shortenDay, type DayTemplate } from '../scheduling/day-template.js';
import type { CalendarDayKind } from './production-calendar.js';

/** How a business follows the official production calendar. */
export interface CalendarPolicy {
  /** Closed on public holidays (e.g. January 1st, May 9th). */
  readonly closeOnPublicHolidays: boolean;
  /** Closed on every official non-working day, including transferred days off. */
  readonly closeOnNonWorkingDays: boolean;
  /** Minutes cut from the end of shortened pre-holiday days; `0` keeps the full day. */
  readonly preHolidayShorteningMinutes: number;
}

export const ignoreProductionCalendar: CalendarPolicy = {
  closeOnPublicHolidays: false,
  closeOnNonWorkingDays: false,
  preHolidayShorteningMinutes: 0,
};

export function validateCalendarPolicy(policy: CalendarPolicy): void {
  invariant(
    Number.isInteger(policy.preHolidayShorteningMinutes) && policy.preHolidayShorteningMinutes >= 0,
    'invalid_booking_rules',
    'Pre-holiday shortening must be a non-negative number of minutes',
  );
}

type DayKindEffect = (template: DayTemplate, policy: CalendarPolicy) => DayTemplate | null;

const dayKindEffects: Record<CalendarDayKind, DayKindEffect> = {
  working: (template) => template,
  non_working: (template, policy) => (policy.closeOnNonWorkingDays ? null : template),
  public_holiday: (template, policy) =>
    policy.closeOnPublicHolidays || policy.closeOnNonWorkingDays ? null : template,
  pre_holiday: (template, policy) => shortenDay(template, policy.preHolidayShorteningMinutes),
};

/** Unknown days (`null` kind) keep the planned hours: the staff schedule stays primary. */
export function applyCalendarPolicy(
  template: DayTemplate,
  kind: CalendarDayKind | null,
  policy: CalendarPolicy,
): DayTemplate | null {
  return kind === null ? template : dayKindEffects[kind](template, policy);
}

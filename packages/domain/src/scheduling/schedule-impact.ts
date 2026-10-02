import type { InstantInterval } from '../time/instant-interval.js';
import { localDateOf, wallIntervalToInstants } from '../time/zoned-time.js';
import { workingIntervals } from './day-template.js';
import {
  resolveStaffDay,
  type CalendarContext,
  type StaffWorkCalendar,
} from './staff-work-calendar.js';

/** A booking of a staff member as a schedule change sees it. */
export interface ScheduledVisit {
  readonly id: string;
  readonly locationId: string;
  /** Time the visit occupies, buffers included. */
  readonly occupied: InstantInterval;
}

/**
 * Visits a work calendar no longer covers: some of their time falls outside the
 * working hours of their day. A schedule change shows these before it is saved.
 */
export function visitsOutsideWork(
  visits: readonly ScheduledVisit[],
  workCalendar: StaffWorkCalendar,
  timeZone: string,
  context: CalendarContext,
): ScheduledVisit[] {
  return visits.filter((visit) => {
    const date = localDateOf(visit.occupied.start, timeZone);
    const day = resolveStaffDay(workCalendar, date, visit.locationId, context);
    if (!day) {
      return true;
    }
    const covered = workingIntervals(day)
      .map((interval) => wallIntervalToInstants(date, interval, timeZone))
      .some(
        (interval) =>
          interval !== null &&
          interval.start <= visit.occupied.start &&
          visit.occupied.end <= interval.end,
      );
    return !covered;
  });
}

import { DomainError } from '../shared/domain-error.js';
import type { InstantInterval } from './instant-interval.js';
import { Temporal } from './temporal.js';
import { MINUTES_PER_DAY, type MinuteOfDay, type WallInterval } from './wall-time.js';

export type PlainDate = Temporal.PlainDate;

const MINUTES_PER_HOUR = 60;

export function assertTimeZone(timeZone: string): void {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(timeZone);
  } catch {
    throw new DomainError('invalid_time', `Unknown time zone "${timeZone}"`);
  }
}

/**
 * Instant of a wall-clock minute on a local date. Times skipped by a DST jump resolve
 * forward (Temporal "compatible"); repeated times resolve to the earlier occurrence.
 */
export function wallMinuteToEpoch(date: PlainDate, minute: MinuteOfDay, timeZone: string): number {
  const day = minute === MINUTES_PER_DAY ? date.add({ days: 1 }) : date;
  const minuteOfDay = minute === MINUTES_PER_DAY ? 0 : minute;
  return day
    .toPlainDateTime({
      hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
      minute: minuteOfDay % MINUTES_PER_HOUR,
    })
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' }).epochMilliseconds;
}

/**
 * Instant of a wall-clock minute, or `null` when the local time does not exist
 * on that date because of a DST gap.
 */
export function existingWallMinuteToEpoch(
  date: PlainDate,
  minute: MinuteOfDay,
  timeZone: string,
): number | null {
  const epoch = wallMinuteToEpoch(date, minute, timeZone);
  const roundTrip = Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(timeZone);
  const expectedDate = minute === MINUTES_PER_DAY ? date.add({ days: 1 }) : date;
  const expectedMinute = minute === MINUTES_PER_DAY ? 0 : minute;
  const actualMinute = roundTrip.hour * MINUTES_PER_HOUR + roundTrip.minute;
  return actualMinute === expectedMinute && roundTrip.toPlainDate().equals(expectedDate)
    ? epoch
    : null;
}

/** Absolute interval of a wall interval on a date; `null` if DST collapses it entirely. */
export function wallIntervalToInstants(
  date: PlainDate,
  interval: WallInterval,
  timeZone: string,
): InstantInterval | null {
  const start = wallMinuteToEpoch(date, interval.start, timeZone);
  const end = wallMinuteToEpoch(date, interval.end, timeZone);
  return start < end ? { start, end } : null;
}

export function localDateOf(epochMs: number, timeZone: string): PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone).toPlainDate();
}

/** Absolute bounds of a local calendar day (23, 24 or 25 hours long around DST). */
export function localDayBounds(date: PlainDate, timeZone: string): InstantInterval {
  const start = date.toZonedDateTime({ timeZone }).epochMilliseconds;
  const end = date.add({ days: 1 }).toZonedDateTime({ timeZone }).epochMilliseconds;
  return { start, end };
}

export function datesBetween(from: PlainDate, to: PlainDate): PlainDate[] {
  const dates: PlainDate[] = [];
  for (let cursor = from; Temporal.PlainDate.compare(cursor, to) <= 0;) {
    dates.push(cursor);
    cursor = cursor.add({ days: 1 });
  }
  return dates;
}

export function maxDate(a: PlainDate, b: PlainDate): PlainDate {
  return Temporal.PlainDate.compare(a, b) >= 0 ? a : b;
}

export function minDate(a: PlainDate, b: PlainDate): PlainDate {
  return Temporal.PlainDate.compare(a, b) <= 0 ? a : b;
}

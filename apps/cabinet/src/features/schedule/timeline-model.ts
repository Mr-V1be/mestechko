import type { ScheduleBooking } from '@mestechko/contracts/client';
import type { BookingStatus } from '@mestechko/domain';
import type { ReactNode } from 'react';

const MINUTES_PER_HOUR = 60;
const DEFAULT_HOURS = { from: 9, to: 20 } as const;

export interface MinuteRange {
  readonly start: number;
  readonly end: number;
}

export interface TimelineBlock {
  readonly id: string;
  readonly status: BookingStatus;
  readonly service: MinuteRange;
  readonly occupied: MinuteRange;
  readonly timeLabel: string;
  readonly startLabel: string;
  readonly client: string;
  readonly services: string;
}

export interface TimelineColumn {
  readonly key: string;
  readonly header: ReactNode;
  readonly working: readonly MinuteRange[];
  readonly blocks: readonly TimelineBlock[];
  /** Minute of "now" when the column shows today. */
  readonly nowMinute: number | null;
}

function parts(instant: string, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minute: Number(get('hour')) * MINUTES_PER_HOUR + Number(get('minute')),
  };
}

export function localDateOf(instant: string, timeZone: string): string {
  return parts(instant, timeZone).date;
}

/**
 * Minutes since local midnight of `date`; instants on other days clamp to the day's
 * edges so that a booking crossing midnight still draws within the column.
 */
export function minuteOn(date: string, instant: string, timeZone: string): number {
  const local = parts(instant, timeZone);
  if (local.date < date) {
    return 0;
  }
  if (local.date > date) {
    return 24 * MINUTES_PER_HOUR;
  }
  return local.minute;
}

export function rangeOn(
  date: string,
  range: { start: string; end: string },
  timeZone: string,
): MinuteRange {
  return { start: minuteOn(date, range.start, timeZone), end: minuteOn(date, range.end, timeZone) };
}

export function toBlock(
  booking: ScheduleBooking,
  date: string,
  timeZone: string,
  formatTime: (instant: string) => string,
): TimelineBlock {
  return {
    id: booking.id,
    status: booking.status,
    service: rangeOn(date, booking, timeZone),
    occupied: rangeOn(date, booking.occupied, timeZone),
    timeLabel: `${formatTime(booking.start)}–${formatTime(booking.end)}`,
    startLabel: formatTime(booking.start),
    client: booking.clientName,
    services: booking.serviceNames.join(', '),
  };
}

/** Visible hours: everything worked or booked, rounded out to whole hours. */
export function visibleHours(columns: readonly TimelineColumn[]): { from: number; to: number } {
  const ranges = columns.flatMap((column) => [
    ...column.working,
    ...column.blocks.map((block) => block.occupied),
  ]);
  if (ranges.length === 0) {
    return DEFAULT_HOURS;
  }
  const from = Math.floor(Math.min(...ranges.map((range) => range.start)) / MINUTES_PER_HOUR);
  const to = Math.ceil(Math.max(...ranges.map((range) => range.end)) / MINUTES_PER_HOUR);
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
}

export function nowMinuteIfToday(date: string, timeZone: string, now: Date): number | null {
  const local = parts(now.toISOString(), timeZone);
  return local.date === date ? local.minute : null;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function todayIn(timeZone: string): string {
  return parts(new Date().toISOString(), timeZone).date;
}

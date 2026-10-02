import { DomainError, invariant } from '../shared/domain-error.js';

/** Minutes since local midnight, `0..1440`; `1440` denotes the end of the day. */
export type MinuteOfDay = number;

export const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;
const WALL_TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Half-open interval of local wall-clock time within a single day. */
export interface WallInterval {
  readonly start: MinuteOfDay;
  readonly end: MinuteOfDay;
}

export function wallInterval(start: MinuteOfDay, end: MinuteOfDay): WallInterval {
  invariant(
    Number.isInteger(start) && Number.isInteger(end),
    'invalid_interval',
    'Wall interval bounds must be whole minutes',
  );
  invariant(
    start >= 0 && end <= MINUTES_PER_DAY && start < end,
    'invalid_interval',
    `Wall interval ${String(start)}-${String(end)} must satisfy 0 <= start < end <= 1440`,
  );
  return { start, end };
}

export function parseWallTime(value: string): MinuteOfDay {
  const match = WALL_TIME_PATTERN.exec(value);
  if (!match) {
    throw new DomainError('invalid_time', `"${value}" is not a HH:MM wall time`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * MINUTES_PER_HOUR + minutes;
  invariant(
    minutes < MINUTES_PER_HOUR && total <= MINUTES_PER_DAY,
    'invalid_time',
    `"${value}" is outside of a day`,
  );
  return total;
}

export function formatWallTime(minute: MinuteOfDay): string {
  const hours = Math.floor(minute / MINUTES_PER_HOUR);
  const minutes = minute % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseWallInterval(start: string, end: string): WallInterval {
  return wallInterval(parseWallTime(start), parseWallTime(end));
}

/** Sorts and merges overlapping or touching intervals. */
export function normalizeWallIntervals(intervals: readonly WallInterval[]): WallInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: WallInterval[] = [];
  for (const current of sorted) {
    const last = merged.at(-1);
    if (last && current.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, current.end) };
    } else {
      merged.push(current);
    }
  }
  return merged;
}

/** Removes every `cut` interval from `base`; both inputs may be unsorted. */
export function subtractWallIntervals(
  base: readonly WallInterval[],
  cut: readonly WallInterval[],
): WallInterval[] {
  const removals = normalizeWallIntervals(cut);
  const result: WallInterval[] = [];
  for (const interval of normalizeWallIntervals(base)) {
    let cursor = interval.start;
    for (const removal of removals) {
      if (removal.end <= cursor || removal.start >= interval.end) {
        continue;
      }
      if (removal.start > cursor) {
        result.push({ start: cursor, end: removal.start });
      }
      cursor = Math.max(cursor, removal.end);
    }
    if (cursor < interval.end) {
      result.push({ start: cursor, end: interval.end });
    }
  }
  return result;
}

import { invariant } from '../shared/domain-error.js';

/** Half-open interval of absolute time in epoch milliseconds. */
export interface InstantInterval {
  readonly start: number;
  readonly end: number;
}

export const MS_PER_MINUTE = 60_000;

export function instantInterval(start: number, end: number): InstantInterval {
  invariant(start < end, 'invalid_interval', 'Instant interval must have a positive length');
  return { start, end };
}

export function intervalsOverlap(a: InstantInterval, b: InstantInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function intervalContains(outer: InstantInterval, inner: InstantInterval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function intervalMinutes(interval: InstantInterval): number {
  return (interval.end - interval.start) / MS_PER_MINUTE;
}

/** Sorts and merges overlapping or touching intervals. */
export function normalizeIntervals(intervals: readonly InstantInterval[]): InstantInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: InstantInterval[] = [];
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

/** Removes `cut` from `base`. Inputs must be normalized (sorted, non-overlapping). */
export function subtractIntervals(
  base: readonly InstantInterval[],
  cut: readonly InstantInterval[],
): InstantInterval[] {
  const result: InstantInterval[] = [];
  let cutIndex = 0;
  for (const interval of base) {
    let cursor = interval.start;
    while (cutIndex < cut.length && (cut[cutIndex]?.end ?? 0) <= cursor) {
      cutIndex += 1;
    }
    for (let index = cutIndex; index < cut.length; index += 1) {
      const removal = cut[index];
      if (!removal || removal.start >= interval.end) {
        break;
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

/**
 * Index of the interval in a normalized list that fully contains `target`, or -1.
 * Binary search keeps lookups logarithmic for long busy lists.
 */
export function findContainingInterval(
  sorted: readonly InstantInterval[],
  target: InstantInterval,
): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const candidate = sorted[middle];
    if (!candidate) {
      return -1;
    }
    if (candidate.end <= target.start) {
      low = middle + 1;
    } else if (candidate.start > target.start) {
      high = middle - 1;
    } else {
      return intervalContains(candidate, target) ? middle : -1;
    }
  }
  return -1;
}

/** Whether any interval of a normalized list overlaps `target`. */
export function anyOverlap(sorted: readonly InstantInterval[], target: InstantInterval): boolean {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const candidate = sorted[middle];
    if (candidate && candidate.end <= target.start) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const first = sorted[low];
  return first !== undefined && first.start < target.end;
}

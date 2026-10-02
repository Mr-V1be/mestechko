import { invariant } from '../shared/domain-error.js';
import {
  normalizeWallIntervals,
  subtractWallIntervals,
  type WallInterval,
} from '../time/wall-time.js';

/** Working hours of one day: work intervals with breaks carved out of them. */
export interface DayTemplate {
  readonly work: readonly WallInterval[];
  readonly breaks: readonly WallInterval[];
}

export function dayTemplate(
  work: readonly WallInterval[],
  breaks: readonly WallInterval[] = [],
): DayTemplate {
  invariant(work.length > 0, 'invalid_schedule', 'A working day needs at least one interval');
  const normalizedWork = normalizeWallIntervals(work);
  invariant(
    normalizedWork.length === work.length,
    'invalid_schedule',
    'Work intervals of a day must not overlap or touch',
  );
  for (const pause of breaks) {
    invariant(
      normalizedWork.some((interval) => interval.start <= pause.start && pause.end <= interval.end),
      'invalid_schedule',
      'A break must lie inside a work interval',
    );
  }
  return { work: normalizedWork, breaks: normalizeWallIntervals(breaks) };
}

/** Time actually available for clients: work minus breaks. */
export function workingIntervals(template: DayTemplate): WallInterval[] {
  return subtractWallIntervals(template.work, template.breaks);
}

/**
 * Ends the day `minutes` earlier, e.g. on shortened pre-holiday days.
 * Returns `null` when nothing of the day remains.
 */
export function shortenDay(template: DayTemplate, minutes: number): DayTemplate | null {
  if (minutes <= 0) {
    return template;
  }
  const lastEnd = Math.max(...template.work.map((interval) => interval.end));
  const cutoff = lastEnd - minutes;
  const work = template.work
    .filter((interval) => interval.start < cutoff)
    .map((interval) => ({ start: interval.start, end: Math.min(interval.end, cutoff) }));
  if (work.length === 0) {
    return null;
  }
  const breaks = template.breaks
    .filter((pause) => pause.start < cutoff)
    .map((pause) => ({ start: pause.start, end: Math.min(pause.end, cutoff) }));
  return { work, breaks };
}

import { MINUTES_PER_DAY } from '../time/wall-time.js';
import { existingWallMinuteToEpoch, type PlainDate } from '../time/zoned-time.js';

/**
 * Candidate start instants of a local day aligned to the wall-clock grid
 * (10:00, 10:15, ...). Wall times skipped by a DST jump are not offered.
 */
export function startGrid(date: PlainDate, timeZone: string, stepMinutes: number): number[] {
  const starts: number[] = [];
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += stepMinutes) {
    const epoch = existingWallMinuteToEpoch(date, minute, timeZone);
    if (epoch !== null && (starts.length === 0 || epoch > (starts.at(-1) ?? 0))) {
      starts.push(epoch);
    }
  }
  return starts;
}

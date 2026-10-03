import { MS_PER_MINUTE } from '../time/instant-interval.js';
import { MINUTES_PER_DAY } from '../time/wall-time.js';
import { existingWallMinuteToEpoch, localDayBounds, type PlainDate } from '../time/zoned-time.js';

const FULL_DAY_MS = MINUTES_PER_DAY * MS_PER_MINUTE;
const MIDDAY = MINUTES_PER_DAY / 2;

/**
 * Candidate start instants of a local day aligned to the wall-clock grid
 * (10:00, 10:15, ...). Wall times skipped by a DST jump are not offered.
 */
export function startGrid(date: PlainDate, timeZone: string, stepMinutes: number): number[] {
  const day = localDayBounds(date, timeZone);
  // Almost every day has no clock change: its wall minutes are plain offsets from
  // midnight, with no time zone lookup per start. The midday probe rules out a day
  // whose two changes cancel each other out.
  if (
    day.end - day.start === FULL_DAY_MS &&
    existingWallMinuteToEpoch(date, MIDDAY, timeZone) === day.start + MIDDAY * MS_PER_MINUTE
  ) {
    const starts: number[] = [];
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += stepMinutes) {
      starts.push(day.start + minute * MS_PER_MINUTE);
    }
    return starts;
  }
  const starts: number[] = [];
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += stepMinutes) {
    const epoch = existingWallMinuteToEpoch(date, minute, timeZone);
    if (epoch !== null && (starts.length === 0 || epoch > (starts.at(-1) ?? 0))) {
      starts.push(epoch);
    }
  }
  return starts;
}

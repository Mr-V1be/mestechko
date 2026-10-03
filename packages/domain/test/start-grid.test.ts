import { describe, expect, it } from 'vitest';
import { startGrid } from '../src/availability/start-grid.js';
import { Temporal } from '../src/time/temporal.js';
import { existingWallMinuteToEpoch } from '../src/time/zoned-time.js';

/** The grid computed minute by minute through the time zone, as the reference. */
function slowGrid(date: Temporal.PlainDate, timeZone: string, step: number): number[] {
  const starts: number[] = [];
  for (let minute = 0; minute < 24 * 60; minute += step) {
    const epoch = existingWallMinuteToEpoch(date, minute, timeZone);
    if (epoch !== null && (starts.length === 0 || epoch > (starts.at(-1) ?? 0))) {
      starts.push(epoch);
    }
  }
  return starts;
}

describe('start grid', () => {
  it.each([
    ['an ordinary day in Moscow', '2026-10-05', 'Europe/Moscow'],
    ['the spring-forward day in Berlin', '2026-03-29', 'Europe/Berlin'],
    ['the fall-back day in Berlin', '2026-10-25', 'Europe/Berlin'],
    ['a day with a half-hour offset', '2026-10-05', 'Asia/Kolkata'],
  ])('matches the zone-by-minute grid on %s', (_name, iso, timeZone) => {
    const date = Temporal.PlainDate.from(iso);
    expect(startGrid(date, timeZone, 15)).toEqual(slowGrid(date, timeZone, 15));
  });

  it('skips wall times that a forward jump removes', () => {
    const date = Temporal.PlainDate.from('2026-03-29');
    const starts = startGrid(date, 'Europe/Berlin', 60);
    expect(starts).toHaveLength(23);
  });
});

import { describe, expect, it } from 'vitest';
import {
  anyOverlap,
  DomainError,
  findContainingInterval,
  formatWallTime,
  normalizeIntervals,
  parseWallTime,
  subtractIntervals,
  subtractWallIntervals,
  wallInterval,
} from '../src/index.js';
import { hours } from './builders.js';

describe('wall time', () => {
  it('parses and formats HH:MM including the end of day', () => {
    expect(parseWallTime('09:30')).toBe(570);
    expect(parseWallTime('24:00')).toBe(1440);
    expect(formatWallTime(570)).toBe('09:30');
  });

  it('rejects malformed and out-of-day values', () => {
    expect(() => parseWallTime('9:30')).toThrow(DomainError);
    expect(() => parseWallTime('24:30')).toThrow(DomainError);
    expect(() => parseWallTime('10:60')).toThrow(DomainError);
    expect(() => wallInterval(600, 600)).toThrow(DomainError);
  });

  it('carves breaks out of working hours', () => {
    const result = subtractWallIntervals(
      [hours('10:00', '19:00')],
      [hours('13:00', '14:00'), hours('16:00', '16:15')],
    );
    expect(result).toEqual([
      hours('10:00', '13:00'),
      hours('14:00', '16:00'),
      hours('16:15', '19:00'),
    ]);
  });
});

describe('instant intervals', () => {
  const list = normalizeIntervals([
    { start: 50, end: 60 },
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ]);

  it('merges touching intervals', () => {
    expect(list).toEqual([
      { start: 0, end: 20 },
      { start: 50, end: 60 },
    ]);
  });

  it('subtracts busy time from free time', () => {
    expect(subtractIntervals([{ start: 0, end: 100 }], list)).toEqual([
      { start: 20, end: 50 },
      { start: 60, end: 100 },
    ]);
  });

  it('treats intervals as half-open', () => {
    expect(anyOverlap(list, { start: 20, end: 50 })).toBe(false);
    expect(anyOverlap(list, { start: 19, end: 21 })).toBe(true);
    expect(findContainingInterval(list, { start: 50, end: 60 })).toBe(1);
    expect(findContainingInterval(list, { start: 15, end: 25 })).toBe(-1);
  });
});

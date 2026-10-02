import { describe, expect, it } from 'vitest';
import { DomainError, findAvailability, Temporal } from '../src/index.js';
import {
  at,
  busy,
  day,
  everyDay,
  MONDAY,
  request,
  rules,
  service,
  staff,
  startsOf,
} from './builders.js';

const halfHourGrid = (from: string, to: string): string[] => {
  const result: string[] = [];
  for (let minute = Number(from.slice(0, 2)) * 60 + Number(from.slice(3)); ; minute += 30) {
    const label = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    result.push(label);
    if (label === to) {
      return result;
    }
  }
};

describe('availability: working hours', () => {
  it('offers grid starts whose service ends by closing time', () => {
    expect(startsOf(findAvailability(request()))).toEqual(halfHourGrid('10:00', '18:00'));
  });

  it('never overlaps a break', () => {
    const anna = staff('anna', {
      pattern: everyDay(day('10:00', '19:00', [['14:00', '15:00']])),
      services: { cut: null },
    });
    const starts = startsOf(findAvailability(request({ staff: [anna] })));
    expect(starts).toContain('13:00');
    expect(starts).not.toContain('13:30');
    expect(starts).not.toContain('14:00');
    expect(starts).not.toContain('14:30');
    expect(starts).toContain('15:00');
  });

  it('keeps preparation and clean-up buffers inside working hours', () => {
    const coloring = service('color', 60, { bufferBeforeMinutes: 10, bufferAfterMinutes: 15 });
    const starts = startsOf(
      findAvailability(
        request({
          services: [coloring],
          staff: [staff('anna', { services: { color: null } })],
          rules: rules({ slotStepMinutes: 15 }),
        }),
      ),
    );
    expect(starts[0]).toBe('10:15');
    expect(starts.at(-1)).toBe('17:45');
  });

  it('offers a slot that ends exactly at midnight', () => {
    const owl = staff('owl', { pattern: everyDay(day('18:00', '24:00')), services: { cut: null } });
    expect(startsOf(findAvailability(request({ staff: [owl] }))).at(-1)).toBe('23:00');
  });
});

describe('availability: existing bookings', () => {
  it('blocks overlapping starts and allows back-to-back bookings', () => {
    const starts = startsOf(
      findAvailability(
        request({
          busy: busy({ staff: [['anna', at('2026-03-02T12:00'), at('2026-03-02T13:00')]] }),
        }),
      ),
    );
    expect(starts).toContain('11:00');
    expect(starts).not.toContain('11:30');
    expect(starts).not.toContain('12:00');
    expect(starts).not.toContain('12:30');
    expect(starts).toContain('13:00');
  });

  it('ignores occupancy of other staff members', () => {
    const starts = startsOf(
      findAvailability(
        request({
          busy: busy({ staff: [['boris', at('2026-03-02T10:00'), at('2026-03-02T19:00')]] }),
        }),
      ),
    );
    expect(starts).toHaveLength(17);
  });
});

describe('availability: service combinations', () => {
  const wash = service('wash', 30, { bufferBeforeMinutes: 20, bufferAfterMinutes: 30 });
  const cut = service('cut', 60, { bufferBeforeMinutes: 0, bufferAfterMinutes: 15 });

  it('runs services back to back and applies buffers only at the edges', () => {
    const days = findAvailability(
      request({
        services: [wash, cut],
        staff: [staff('anna', { services: { wash: null, cut: null } })],
      }),
    );
    const starts = startsOf(days);
    // 20 minutes of preparation must fit after opening: 10:00 is too early.
    expect(starts[0]).toBe('10:30');
    // 90 minutes of service plus 15 minutes of clean-up must end by 19:00.
    expect(starts.at(-1)).toBe('17:00');
  });

  it('uses the personal duration of a staff member', () => {
    const slow = staff('slow', { services: { cut: 90 } });
    expect(startsOf(findAvailability(request({ staff: [slow] }))).at(-1)).toBe('17:30');
  });

  it('only considers staff providing every chosen service', () => {
    const days = findAvailability(
      request({
        services: [wash, cut],
        staff: [
          staff('anna', { services: { wash: null, cut: null } }),
          staff('boris', { services: { cut: null } }),
        ],
      }),
    );
    expect(new Set(days.flatMap((entry) => entry.slots.flatMap((slot) => slot.staffIds)))).toEqual(
      new Set(['anna']),
    );
  });

  it('rejects empty, duplicated and oversized combinations', () => {
    expect(() => findAvailability(request({ services: [] }))).toThrow(DomainError);
    expect(() => findAvailability(request({ services: [cut, cut] }))).toThrow(DomainError);
    expect(() =>
      findAvailability(
        request({
          services: [wash, cut, service('a', 10), service('b', 10)],
          rules: rules({ maxServicesPerBooking: 3 }),
        }),
      ),
    ).toThrow(DomainError);
  });
});

describe('availability: booking window', () => {
  it('respects the minimal lead time', () => {
    const days = findAvailability(
      request({
        now: Temporal.Instant.fromEpochMilliseconds(at('2026-03-02T11:10')),
        rules: rules({ minLeadMinutes: 60 }),
      }),
    );
    expect(startsOf(days)[0]).toBe('12:30');
  });

  it('never returns past dates and stops at the booking horizon', () => {
    const days = findAvailability(
      request({
        from: MONDAY.subtract({ days: 3 }),
        to: MONDAY.add({ days: 30 }),
        rules: rules({ horizonDays: 7 }),
      }),
    );
    expect(days[0]?.date.toString()).toBe('2026-03-01');
    expect(days.at(-1)?.date.toString()).toBe('2026-03-08');
  });

  it('returns no slots without eligible staff', () => {
    expect(startsOf(findAvailability(request({ staff: [] })))).toEqual([]);
  });
});

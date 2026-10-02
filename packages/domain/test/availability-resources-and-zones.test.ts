import { describe, expect, it } from 'vitest';
import { findAvailability, localDayBounds, Temporal } from '../src/index.js';
import {
  at,
  busy,
  clock,
  date,
  day,
  everyDay,
  LOCATION_ID,
  request,
  rules,
  service,
  staff,
  startsOf,
} from './builders.js';

describe('availability: resources', () => {
  const chairCut = service('cut', 60, { resourceTypeId: 'chair' });
  const twoStaff = [
    staff('anna', { rank: 1, services: { cut: null } }),
    staff('boris', { rank: 2, services: { cut: null } }),
  ];

  it('blocks every staff member when the only chair is busy', () => {
    const days = findAvailability(
      request({
        services: [chairCut],
        staff: twoStaff,
        resources: [{ id: 'chair-1', typeId: 'chair' }],
        busy: busy({ resources: [['chair-1', at('2026-03-02T12:00'), at('2026-03-02T13:00')]] }),
      }),
    );
    const starts = startsOf(days);
    expect(starts).not.toContain('12:00');
    expect(starts).toContain('13:00');
  });

  it('uses another resource of the same type when one is taken', () => {
    const days = findAvailability(
      request({
        services: [chairCut],
        staff: twoStaff,
        resources: [
          { id: 'chair-1', typeId: 'chair' },
          { id: 'chair-2', typeId: 'chair' },
        ],
        busy: busy({ resources: [['chair-1', at('2026-03-02T12:00'), at('2026-03-02T13:00')]] }),
      }),
    );
    const noon = days[0]?.slots.find((slot) => clock(slot.start) === '12:00');
    expect(noon?.staffIds).toHaveLength(2);
  });

  it('offers nothing when the location lacks the required resource type', () => {
    expect(startsOf(findAvailability(request({ services: [chairCut], staff: twoStaff })))).toEqual(
      [],
    );
  });

  it('keeps resource buffers clear of other bookings', () => {
    const prepared = service('cut', 60, { resourceTypeId: 'chair', bufferBeforeMinutes: 10 });
    const starts = startsOf(
      findAvailability(
        request({
          services: [prepared],
          resources: [{ id: 'chair-1', typeId: 'chair' }],
          busy: busy({ resources: [['chair-1', at('2026-03-02T10:00'), at('2026-03-02T12:00')]] }),
          rules: rules({ slotStepMinutes: 15 }),
        }),
      ),
    );
    expect(starts[0]).toBe('12:15');
  });

  it('serves services needing different resource types in one booking', () => {
    const consultation = service('consult', 30, { resourceTypeId: 'room' });
    const xray = service('xray', 15, { resourceTypeId: 'xray' });
    const days = findAvailability(
      request({
        services: [consultation, xray],
        staff: [staff('doc', { services: { consult: null, xray: null } })],
        resources: [
          { id: 'room-1', typeId: 'room' },
          { id: 'xray-1', typeId: 'xray' },
        ],
        busy: busy({ resources: [['xray-1', at('2026-03-02T10:30'), at('2026-03-02T10:45')]] }),
      }),
    );
    const starts = startsOf(days);
    expect(starts).not.toContain('10:00');
    expect(starts).toContain('10:30');
  });
});

describe('availability: time zones', () => {
  it('computes local working hours of a location far from the server', () => {
    const novosibirsk = 'Asia/Novosibirsk';
    const days = findAvailability(
      request({
        location: { id: LOCATION_ID, timeZone: novosibirsk },
        now: Temporal.Instant.from('2026-03-01T00:00:00Z'),
      }),
    );
    const first = days[0]?.slots[0];
    expect(first && new Date(first.start).toISOString()).toBe('2026-03-02T03:00:00.000Z');
    expect(startsOf(days, novosibirsk).at(-1)).toBe('18:00');
  });

  it('skips wall times removed by the spring DST jump and keeps real durations', () => {
    const berlin = 'Europe/Berlin';
    const nightOwl = staff('owl', {
      pattern: everyDay(day('00:00', '06:00')),
      services: { cut: null },
    });
    const springForward = date('2026-03-29');
    const days = findAvailability(
      request({
        location: { id: LOCATION_ID, timeZone: berlin },
        from: springForward,
        to: springForward,
        staff: [nightOwl],
        now: Temporal.Instant.from('2026-03-20T00:00:00Z'),
      }),
    );
    expect(startsOf(days, berlin)).toEqual([
      '00:00',
      '00:30',
      '01:00',
      '01:30',
      '03:00',
      '03:30',
      '04:00',
      '04:30',
      '05:00',
    ]);
    const bounds = localDayBounds(springForward, berlin);
    expect((bounds.end - bounds.start) / 3_600_000).toBe(23);
  });

  it('offers the repeated autumn hour once and keeps the day 25 hours long', () => {
    const berlin = 'Europe/Berlin';
    const nightOwl = staff('owl', {
      pattern: everyDay(day('00:00', '05:00')),
      services: { cut: null },
    });
    const fallBack = date('2026-10-25');
    const days = findAvailability(
      request({
        location: { id: LOCATION_ID, timeZone: berlin },
        from: fallBack,
        to: fallBack,
        staff: [nightOwl],
        now: Temporal.Instant.from('2026-10-20T00:00:00Z'),
      }),
    );
    const starts = days[0]?.slots.map((slot) => slot.start) ?? [];
    expect(starts).toHaveLength(9);
    expect(new Set(starts).size).toBe(starts.length);
    const bounds = localDayBounds(fallBack, berlin);
    expect((bounds.end - bounds.start) / 3_600_000).toBe(25);
  });
});

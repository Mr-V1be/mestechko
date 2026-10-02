import { describe, expect, it } from 'vitest';
import { earliestSlotByStaff, planBookingOptions, Temporal } from '../src/index.js';
import { at, busy, date, request, rules, service, staff } from './builders.js';

const team = [
  staff('anna', { rank: 1, services: { cut: null } }),
  staff('boris', { rank: 2, services: { cut: null } }),
];

describe('planning a booking', () => {
  it('returns item ranges with edge buffers and assigned resources', () => {
    const wash = service('wash', 30, { bufferBeforeMinutes: 10, resourceTypeId: 'sink' });
    const cut = service('cut', 60, { bufferAfterMinutes: 15, resourceTypeId: 'chair' });
    const [plan] = planBookingOptions(
      request({
        services: [wash, cut],
        staff: [staff('anna', { services: { wash: null, cut: null } })],
        resources: [
          { id: 'sink-1', typeId: 'sink' },
          { id: 'chair-1', typeId: 'chair' },
        ],
      }),
      at('2026-03-02T11:00'),
    );
    expect(plan).toEqual({
      staffId: 'anna',
      start: at('2026-03-02T11:00'),
      end: at('2026-03-02T12:30'),
      occupied: { start: at('2026-03-02T10:50'), end: at('2026-03-02T12:45') },
      items: [
        {
          serviceId: 'wash',
          start: at('2026-03-02T11:00'),
          end: at('2026-03-02T11:30'),
          occupied: { start: at('2026-03-02T10:50'), end: at('2026-03-02T11:30') },
          resourceId: 'sink-1',
        },
        {
          serviceId: 'cut',
          start: at('2026-03-02T11:30'),
          end: at('2026-03-02T12:30'),
          occupied: { start: at('2026-03-02T11:30'), end: at('2026-03-02T12:45') },
          resourceId: 'chair-1',
        },
      ],
    });
  });

  it('refuses starts that are not offered slots', () => {
    const base = request({ staff: team });
    expect(planBookingOptions(base, at('2026-03-02T11:10'))).toEqual([]);
    expect(planBookingOptions(base, at('2026-03-02T08:00'))).toEqual([]);
    expect(planBookingOptions(base, at('2026-02-27T11:00'))).toEqual([]);
    const taken = request({
      staff: team.slice(0, 1),
      busy: busy({ staff: [['anna', at('2026-03-02T11:00'), at('2026-03-02T12:00')]] }),
    });
    expect(planBookingOptions(taken, at('2026-03-02T11:00'))).toEqual([]);
  });

  it('puts the least booked staff member first for balanced assignment', () => {
    const plans = planBookingOptions(
      request({
        staff: team,
        busy: busy({ staff: [['anna', at('2026-03-02T15:00'), at('2026-03-02T17:00')]] }),
      }),
      at('2026-03-02T11:00'),
    );
    expect(plans.map((plan) => plan.staffId)).toEqual(['boris', 'anna']);
  });

  it('keeps the business order for first-listed assignment', () => {
    const plans = planBookingOptions(
      request({
        staff: team,
        rules: rules({ staffAssignment: 'first_listed' }),
        busy: busy({ staff: [['anna', at('2026-03-02T15:00'), at('2026-03-02T17:00')]] }),
      }),
      at('2026-03-02T11:00'),
    );
    expect(plans.map((plan) => plan.staffId)).toEqual(['anna', 'boris']);
  });
});

describe('earliest free time per staff member', () => {
  it('finds the first free start of each staff member across days', () => {
    const earliest = earliestSlotByStaff(
      request({
        staff: team,
        to: date('2026-03-05'),
        now: Temporal.Instant.fromEpochMilliseconds(at('2026-03-02T09:00')),
        busy: busy({ staff: [['anna', at('2026-03-02T10:00'), at('2026-03-02T19:00')]] }),
      }),
    );
    expect(earliest.get('anna')).toBe(at('2026-03-03T10:00'));
    expect(earliest.get('boris')).toBe(at('2026-03-02T10:00'));
  });
});

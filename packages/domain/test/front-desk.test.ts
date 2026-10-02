import { describe, expect, it } from 'vitest';
import {
  canMovePaymentTo,
  explainUnavailable,
  frontDeskRules,
  planBookingOptions,
  Temporal,
} from '../src/index.js';
import { at, busy, date, request, rules, service, staff } from './builders.js';

const chairCut = service('cut', 60, { resourceTypeId: 'chair' });
const anna = staff('anna', {
  services: { cut: null },
  overrides: [{ date: date('2026-03-03'), locationId: null, template: null }],
});
const desk = (overrides: Parameters<typeof request>[0] = {}) =>
  request({
    services: [chairCut],
    staff: [anna, staff('boris', { services: {} })],
    resources: [{ id: 'chair-1', typeId: 'chair' }],
    rules: frontDeskRules(rules()),
    now: Temporal.Instant.fromEpochMilliseconds(at('2026-03-02T09:00')),
    to: date('2026-03-10'),
    ...overrides,
  });

describe('front desk planning', () => {
  it('places a booking at any five minutes inside working hours', () => {
    expect(planBookingOptions(desk(), at('2026-03-02T10:05'))).toHaveLength(1);
    expect(explainUnavailable(desk(), 'anna', at('2026-03-02T10:05'))).toBeNull();
  });

  it('names the reason a start does not work, most basic first', () => {
    const occupied = desk({
      busy: busy({
        staff: [['anna', at('2026-03-02T12:00'), at('2026-03-02T13:00')]],
        resources: [['chair-1', at('2026-03-02T15:00'), at('2026-03-02T16:00')]],
      }),
    });
    const reasonAt = (iso: string, staffId = 'anna') =>
      explainUnavailable(occupied, staffId, at(iso));
    expect(reasonAt('2026-03-02T08:00')).toBe('past');
    expect(reasonAt('2026-03-02T10:07')).toBe('off_grid');
    expect(reasonAt('2026-03-02T10:00', 'boris')).toBe('not_qualified');
    expect(reasonAt('2026-03-03T11:00')).toBe('not_working');
    expect(reasonAt('2026-03-02T18:30')).toBe('outside_hours');
    expect(reasonAt('2026-03-02T12:30')).toBe('staff_busy');
    expect(reasonAt('2026-03-02T15:00')).toBe('resource_busy');
  });

  it('is limited by the horizon of the request rules', () => {
    const online = desk({ rules: rules({ horizonDays: 3 }) });
    expect(explainUnavailable(online, 'anna', at('2026-03-09T11:00'))).toBe('beyond_horizon');
  });
});

describe('payment statuses', () => {
  it('lets late money arrive after the booking stopped waiting', () => {
    expect(canMovePaymentTo('cancelled', 'succeeded')).toBe(true);
    expect(canMovePaymentTo('succeeded', 'refunded')).toBe(true);
    expect(canMovePaymentTo('refunded', 'succeeded')).toBe(false);
    expect(canMovePaymentTo('pending', 'refunded')).toBe(false);
  });
});

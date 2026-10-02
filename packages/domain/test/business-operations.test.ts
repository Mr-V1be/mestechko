import { describe, expect, it } from 'vitest';
import {
  assertCompatible,
  businessBookingActions,
  canMoveToStatus,
  depositFor,
  DomainError,
  frontDeskRules,
  holdExpiry,
  incompatibleWith,
  refundsDeposit,
  resolveBookingRules,
  type BusinessBookingAction,
  type BusinessBookingState,
} from '../src/index.js';
import { rules } from './builders.js';

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 10, 9, 0);

describe('booking status transitions', () => {
  it('lets a held booking be confirmed or released, and nothing else', () => {
    expect(canMoveToStatus('held', 'confirmed')).toBe(true);
    expect(canMoveToStatus('held', 'cancelled')).toBe(true);
    expect(canMoveToStatus('held', 'completed')).toBe(false);
    expect(canMoveToStatus('confirmed', 'held')).toBe(false);
  });

  it('closes final statuses', () => {
    for (const status of ['completed', 'no_show', 'cancelled'] as const) {
      expect(canMoveToStatus(status, 'confirmed')).toBe(false);
      expect(canMoveToStatus(status, 'cancelled')).toBe(false);
    }
  });
});

describe('business booking actions', () => {
  const available = (booking: BusinessBookingState, now: number) =>
    (Object.keys(businessBookingActions) as BusinessBookingAction[]).filter((action) =>
      businessBookingActions[action].isAvailable(booking, now),
    );

  it('moves and cancels upcoming visits but marks them only once they begin', () => {
    const upcoming = { status: 'confirmed' as const, startsAt: NOW + 60 * MINUTE };
    expect(available(upcoming, NOW)).toEqual(['move', 'cancel']);
    expect(available(upcoming, NOW + 60 * MINUTE)).toEqual([
      'move',
      'cancel',
      'complete',
      'no_show',
    ]);
  });

  it('only releases a held booking and leaves finished ones alone', () => {
    expect(available({ status: 'held', startsAt: NOW - MINUTE }, NOW)).toEqual(['cancel']);
    expect(available({ status: 'completed', startsAt: NOW - MINUTE }, NOW)).toEqual([]);
  });
});

describe('holds', () => {
  it('holds for the minutes the business rules give each reason', () => {
    const custom = rules({ prepayment: { holdMinutes: 25 }, waitlist: { offerHoldMinutes: 40 } });
    expect(holdExpiry('payment', custom, NOW)).toBe(NOW + 25 * MINUTE);
    expect(holdExpiry('waitlist_offer', custom, NOW)).toBe(NOW + 40 * MINUTE);
  });

  it('rejects holds shorter than five minutes or longer than a day', () => {
    expect(() => rules({ waitlist: { offerHoldMinutes: 4 } })).toThrow(DomainError);
    expect(() => rules({ prepayment: { holdMinutes: 24 * 60 + 1 } })).toThrow(DomainError);
  });

  it('keeps vertical defaults for what a business did not override', () => {
    const base = rules();
    const merged = resolveBookingRules(base, { prepayment: { depositPercent: 30 } });
    expect(merged.prepayment).toEqual({ depositPercent: 30, holdMinutes: 15 });
  });
});

describe('prepayment', () => {
  it('takes each service share, falling back to the business rule', () => {
    const deposit = depositFor(
      [
        { priceMinor: 450_000, depositPercent: 30 },
        { priceMinor: 120_000, depositPercent: null },
        { priceMinor: 99_999, depositPercent: 0 },
      ],
      10,
      'RUB',
    );
    expect(deposit).toEqual({ amountMinor: 135_000 + 12_000, currency: 'RUB' });
  });

  it('rounds to whole minor units and rejects shares over 100 percent', () => {
    expect(depositFor([{ priceMinor: 333, depositPercent: 50 }], 0, 'RUB').amountMinor).toBe(167);
    expect(() => depositFor([{ priceMinor: 100, depositPercent: 101 }], 0, 'RUB')).toThrow(
      DomainError,
    );
  });

  it('refunds when the business cancels or the client cancels in time', () => {
    expect(refundsDeposit('business', 'too_late')).toBe(true);
    expect(refundsDeposit('client', 'allowed')).toBe(true);
    expect(refundsDeposit('client', 'too_late')).toBe(false);
  });
});

describe('incompatible services', () => {
  const pairs = [
    { serviceId: 'colour', otherServiceId: 'perm' },
    { serviceId: 'perm', otherServiceId: 'keratin' },
  ];

  it('blocks whatever conflicts with a chosen service, in both directions', () => {
    expect([...incompatibleWith(['perm'], pairs)].sort()).toEqual(['colour', 'keratin']);
    expect([...incompatibleWith(['colour'], pairs)]).toEqual(['perm']);
    expect(incompatibleWith([], pairs).size).toBe(0);
  });

  it('refuses a combination containing a pair', () => {
    expect(() => {
      assertCompatible(['colour', 'cut'], pairs);
    }).not.toThrow();
    expect(() => {
      assertCompatible(['keratin', 'perm'], pairs);
    }).toThrow(DomainError);
  });
});

describe('front desk rules', () => {
  it('drops the online limits but keeps everything else', () => {
    const online = rules({ slotStepMinutes: 30, minLeadMinutes: 120, horizonDays: 30 });
    const desk = frontDeskRules(online);
    expect(desk).toEqual({
      ...online,
      slotStepMinutes: 5,
      minLeadMinutes: 0,
      horizonDays: 366,
    });
  });
});

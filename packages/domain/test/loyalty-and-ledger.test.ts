import { describe, expect, it } from 'vitest';
import {
  assertCovered,
  DomainError,
  passCovers,
  passValidUntil,
  pointsEarned,
  pointsRedeemable,
  settleVisit,
  validateLedgerEntry,
  validateLoyaltySettings,
  validatePassPlan,
  type LoyaltySettings,
} from '../src/index.js';
import { date } from './builders.js';

const cashback: LoyaltySettings = {
  kind: 'cashback_points',
  accrualPercent: 5,
  maxRedeemPercent: 30,
};
const none: LoyaltySettings = { kind: 'none', accrualPercent: 0, maxRedeemPercent: 0 };

describe('ledger entries', () => {
  it('requires the sign its reason implies', () => {
    expect(() => {
      validateLedgerEntry('points_accrual', 10);
    }).not.toThrow();
    expect(() => {
      validateLedgerEntry('points_accrual', -10);
    }).toThrow(DomainError);
    expect(() => {
      validateLedgerEntry('pass_visit', -1);
    }).not.toThrow();
    expect(() => {
      validateLedgerEntry('prepayment_refund', 500);
    }).toThrow(DomainError);
    expect(() => {
      validateLedgerEntry('points_adjustment', -3);
    }).not.toThrow();
  });

  it('rejects zero and fractional amounts', () => {
    expect(() => {
      validateLedgerEntry('points_adjustment', 0);
    }).toThrow(DomainError);
    expect(() => {
      validateLedgerEntry('visit_payment', 10.5);
    }).toThrow(DomainError);
  });

  it('never takes a balance below zero', () => {
    expect(() => {
      assertCovered(5, -5);
    }).not.toThrow();
    expect(() => {
      assertCovered(5, -6);
    }).toThrow(DomainError);
  });
});

describe('loyalty points', () => {
  it('earns a share of the money paid, in whole points', () => {
    expect(pointsEarned(cashback, 259_900)).toBe(129);
    expect(pointsEarned(none, 259_900)).toBe(0);
  });

  it('redeems up to the share of the total and the balance', () => {
    expect(pointsRedeemable(cashback, 300_000, 5_000)).toBe(900);
    expect(pointsRedeemable(cashback, 300_000, 120)).toBe(120);
    expect(pointsRedeemable(none, 300_000, 5_000)).toBe(0);
  });

  it('accepts only whole percentages', () => {
    expect(() => {
      validateLoyaltySettings({ ...cashback, accrualPercent: 2.5 });
    }).toThrow(DomainError);
    expect(() => {
      validateLoyaltySettings({ ...cashback, maxRedeemPercent: 101 });
    }).toThrow(DomainError);
  });
});

describe('passes', () => {
  const plan = { visits: 5, validityDays: 30, priceMinor: 900_000, serviceIds: ['cut'] };

  it('is valid for its days counting the day of sale', () => {
    expect(passValidUntil(plan, date('2026-10-01')).toString()).toBe('2026-10-30');
  });

  it('covers a visit of its services while visits and days remain', () => {
    const pass = { serviceIds: ['cut', 'wash'], validUntil: date('2026-10-30'), visitsLeft: 1 };
    expect(passCovers(pass, ['cut'], date('2026-10-30'))).toBe(true);
    expect(passCovers(pass, ['cut', 'colour'], date('2026-10-10'))).toBe(false);
    expect(passCovers(pass, ['cut'], date('2026-10-31'))).toBe(false);
    expect(passCovers({ ...pass, visitsLeft: 0 }, ['cut'], date('2026-10-10'))).toBe(false);
  });

  it('rejects plans without services or with impossible terms', () => {
    expect(() => {
      validatePassPlan({ ...plan, serviceIds: [] });
    }).toThrow(DomainError);
    expect(() => {
      validatePassPlan({ ...plan, visits: 0 });
    }).toThrow(DomainError);
    expect(() => {
      validatePassPlan({ ...plan, validityDays: 731 });
    }).toThrow(DomainError);
  });
});

describe('visit settlement', () => {
  const base = {
    totalMinor: 300_000,
    prepaidMinor: 0,
    passId: null,
    pointsRequested: 0,
    pointsBalance: 0,
    loyalty: cashback,
  };

  it('charges the rest after the prepayment and accrues points on all money paid', () => {
    const settlement = settleVisit({ ...base, prepaidMinor: 90_000 });
    expect(settlement.dueMinor).toBe(210_000);
    expect(settlement.entries).toEqual([
      { reason: 'visit_payment', amount: 210_000, passId: null },
      { reason: 'points_accrual', amount: 150, passId: null },
    ]);
  });

  it('pays with points within the limit and earns only on money', () => {
    const settlement = settleVisit({ ...base, pointsRequested: 2_000, pointsBalance: 2_000 });
    expect(settlement.pointsRedeemed).toBe(900);
    expect(settlement.dueMinor).toBe(210_000);
    expect(settlement.entries.map((entry) => [entry.reason, entry.amount])).toEqual([
      ['points_redemption', -900],
      ['visit_payment', 210_000],
      ['points_accrual', 105],
    ]);
  });

  it('settles a pass visit with one visit and returns a prepayment', () => {
    const settlement = settleVisit({ ...base, prepaidMinor: 90_000, passId: 'pass-1' });
    expect(settlement.entries).toEqual([{ reason: 'pass_visit', amount: -1, passId: 'pass-1' }]);
    expect(settlement.dueMinor).toBe(0);
    expect(settlement.prepaymentRefundMinor).toBe(90_000);
  });

  it('returns the part of a prepayment above a total that went down', () => {
    const settlement = settleVisit({ ...base, totalMinor: 80_000, prepaidMinor: 90_000 });
    expect(settlement.dueMinor).toBe(0);
    expect(settlement.prepaymentRefundMinor).toBe(10_000);
    expect(settlement.entries).toEqual([{ reason: 'points_accrual', amount: 40, passId: null }]);
  });

  it('writes nothing for a free visit without loyalty', () => {
    const settlement = settleVisit({ ...base, totalMinor: 0, loyalty: none });
    expect(settlement.entries).toEqual([]);
  });
});

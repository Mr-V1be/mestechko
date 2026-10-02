import { invariant } from '../shared/domain-error.js';
import type { LedgerReason } from './ledger.js';
import {
  MINOR_PER_POINT,
  pointsEarned,
  pointsRedeemable,
  type LoyaltySettings,
} from './loyalty-program.js';

/** How a completed visit is paid for, as the front desk chose it. */
export interface VisitSettlementInput {
  readonly totalMinor: number;
  /** Prepayment received for this booking and not refunded. */
  readonly prepaidMinor: number;
  /** A pass of the client that covers the visit, when the visit is paid with it. */
  readonly passId: string | null;
  /** Points the client wants to pay with; fewer are taken if the rules allow fewer. */
  readonly pointsRequested: number;
  readonly pointsBalance: number;
  readonly loyalty: LoyaltySettings;
}

export interface PlannedLedgerEntry {
  readonly reason: LedgerReason;
  readonly amount: number;
  readonly passId: string | null;
}

export interface VisitSettlement {
  readonly entries: readonly PlannedLedgerEntry[];
  /** Money the client pays at the visit, in minor units. */
  readonly dueMinor: number;
  readonly pointsRedeemed: number;
  /**
   * Prepayment that goes back to the client: all of it when a pass pays for the visit,
   * otherwise whatever exceeds the total (the visit became cheaper after it was paid).
   */
  readonly prepaymentRefundMinor: number;
}

/**
 * Settles a completed visit into ledger entries: a pass visit, or the money due after
 * the prepayment and redeemed points, plus the points the paid money earns.
 */
export function settleVisit(input: VisitSettlementInput): VisitSettlement {
  invariant(
    Number.isSafeInteger(input.totalMinor) &&
      input.totalMinor >= 0 &&
      Number.isSafeInteger(input.prepaidMinor) &&
      input.prepaidMinor >= 0 &&
      Number.isSafeInteger(input.pointsRequested) &&
      input.pointsRequested >= 0,
    'invalid_ledger_entry',
    'A visit is settled in whole non-negative amounts',
  );
  if (input.passId !== null) {
    return {
      entries: [{ reason: 'pass_visit', amount: -1, passId: input.passId }],
      dueMinor: 0,
      pointsRedeemed: 0,
      prepaymentRefundMinor: input.prepaidMinor,
    };
  }
  const keptMinor = Math.min(input.prepaidMinor, input.totalMinor);
  const payableMinor = input.totalMinor - keptMinor;
  const pointsRedeemed = Math.min(
    input.pointsRequested,
    pointsRedeemable(input.loyalty, input.totalMinor, input.pointsBalance),
    Math.floor(payableMinor / MINOR_PER_POINT),
  );
  const dueMinor = payableMinor - pointsRedeemed * MINOR_PER_POINT;
  const earned = pointsEarned(input.loyalty, keptMinor + dueMinor);
  const entries: PlannedLedgerEntry[] = [];
  if (pointsRedeemed > 0) {
    entries.push({ reason: 'points_redemption', amount: -pointsRedeemed, passId: null });
  }
  if (dueMinor > 0) {
    entries.push({ reason: 'visit_payment', amount: dueMinor, passId: null });
  }
  if (earned > 0) {
    entries.push({ reason: 'points_accrual', amount: earned, passId: null });
  }
  return {
    entries,
    dueMinor,
    pointsRedeemed,
    prepaymentRefundMinor: input.prepaidMinor - keptMinor,
  };
}

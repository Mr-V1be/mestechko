import { invariant } from '../shared/domain-error.js';

const PERCENT = 100;
/** One point pays one unit of the currency. */
export const MINOR_PER_POINT = 100;

interface LoyaltyKindDefinition {
  /** Points earned for a paid visit. */
  readonly accrue: (settings: LoyaltySettings, paidMinor: number) => number;
  /** The most points a visit of this total may be paid with. */
  readonly redeemLimit: (settings: LoyaltySettings, totalMinor: number) => number;
}

/** A business's loyalty settings; one point pays one unit of the currency. */
export interface LoyaltySettings {
  readonly kind: LoyaltyKind;
  readonly accrualPercent: number;
  readonly maxRedeemPercent: number;
}

/**
 * Kinds of loyalty programs. A business picks one and sets its percentages; a new kind
 * is a new entry here.
 */
export const loyaltyKinds = {
  none: { accrue: () => 0, redeemLimit: () => 0 },
  cashback_points: {
    accrue: (settings, paidMinor) =>
      Math.floor((paidMinor * settings.accrualPercent) / PERCENT / MINOR_PER_POINT),
    redeemLimit: (settings, totalMinor) =>
      Math.floor((totalMinor * settings.maxRedeemPercent) / PERCENT / MINOR_PER_POINT),
  },
} as const satisfies Record<string, LoyaltyKindDefinition>;

export type LoyaltyKind = keyof typeof loyaltyKinds;

export const loyaltyKindIds = Object.keys(loyaltyKinds) as LoyaltyKind[];

export function validateLoyaltySettings(settings: LoyaltySettings): void {
  for (const percent of [settings.accrualPercent, settings.maxRedeemPercent]) {
    invariant(
      Number.isInteger(percent) && percent >= 0 && percent <= PERCENT,
      'invalid_loyalty',
      'Loyalty percentages are whole numbers from 0 to 100',
    );
  }
}

export function pointsEarned(settings: LoyaltySettings, paidMinor: number): number {
  return loyaltyKinds[settings.kind].accrue(settings, paidMinor);
}

export function pointsRedeemable(
  settings: LoyaltySettings,
  totalMinor: number,
  balance: number,
): number {
  return Math.max(
    0,
    Math.min(balance, loyaltyKinds[settings.kind].redeemLimit(settings, totalMinor)),
  );
}

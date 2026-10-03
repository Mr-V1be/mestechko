import { loyaltyKindIds, type LoyaltyKind, type LoyaltySettings } from '@mestechko/domain';

/** Percentages a business sets for its program. */
export type ProgramSetting = Exclude<keyof LoyaltySettings, 'kind'>;

interface LoyaltyKindView {
  /** Settings the kind uses, in the order they are shown. */
  readonly settings: readonly ProgramSetting[];
  /** Values offered when the program is switched on for the first time. */
  readonly suggested: Readonly<Record<ProgramSetting, number>>;
}

/** The kind that means the business runs no program at all. */
export const NO_PROGRAM = 'none' satisfies LoyaltyKind;

/**
 * How each kind of the domain's registry is set up in the cabinet. A new kind in the
 * domain does not compile until it gets its entry here.
 */
export const loyaltyKindViews: Readonly<Record<LoyaltyKind, LoyaltyKindView>> = {
  none: { settings: [], suggested: { accrualPercent: 0, maxRedeemPercent: 0 } },
  cashback_points: {
    settings: ['accrualPercent', 'maxRedeemPercent'],
    suggested: { accrualPercent: 5, maxRedeemPercent: 30 },
  },
};

/** Kinds a business can switch on, in the registry's order. */
export const programKinds = loyaltyKindIds.filter((kind) => kind !== NO_PROGRAM);

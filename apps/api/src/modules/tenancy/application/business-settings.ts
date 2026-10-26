import type { BusinessRules, BusinessSettings as SettingsView } from '@slotwise/contracts';
import {
  resolveBookingRules,
  type BookingRules,
  type BookingRulesOverrides,
  type Clock,
} from '@slotwise/domain';
import type { BusinessDirectory } from './business-directory.js';
import type { BusinessContextResolver } from './business-context.js';

function viewOf(rules: BookingRules): BusinessRules {
  return {
    slotStepMinutes: rules.slotStepMinutes,
    minLeadMinutes: rules.minLeadMinutes,
    horizonDays: rules.horizonDays,
    staffAssignment: rules.staffAssignment,
    clientChangeCutoffMinutes: rules.clientChanges.cutoffMinutes,
    depositPercent: rules.prepayment.depositPercent,
    paymentHoldMinutes: rules.prepayment.holdMinutes,
    waitlistOfferHoldMinutes: rules.waitlist.offerHoldMinutes,
  };
}

/** The value if it differs from the default; only differences are stored. */
const differs = <T>(value: T, fallback: T): T | undefined =>
  value === fallback ? undefined : value;

function dropEmpty(overrides: Record<string, unknown>): BookingRulesOverrides {
  return Object.fromEntries(
    Object.entries(overrides).flatMap(([key, value]): [string, unknown][] => {
      if (value === undefined) {
        return [];
      }
      if (typeof value === 'object' && value !== null) {
        const nested = Object.entries(value).filter(([, inner]) => inner !== undefined);
        return nested.length > 0 ? [[key, Object.fromEntries(nested)]] : [];
      }
      return [[key, value]];
    }),
  );
}

/**
 * The business's own settings: its name and the booking rules it tunes. Rules equal
 * to the vertical's defaults are not stored, so later default changes reach it.
 */
export class BusinessSettings {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly directory: BusinessDirectory,
    private readonly clock: Clock,
  ) {}

  async get(businessId: string): Promise<SettingsView> {
    const { business, vertical, rules } = await this.businesses.byId(businessId);
    return { name: business.name, rules: viewOf(rules), defaults: viewOf(vertical.rules) };
  }

  async update(
    businessId: string,
    input: { readonly name: string; readonly rules: BusinessRules },
  ): Promise<SettingsView> {
    const { business, vertical } = await this.businesses.byId(businessId);
    const defaults = vertical.rules;
    const kept = business.rulesOverrides;
    const overrides = dropEmpty({
      ...kept,
      slotStepMinutes: differs(input.rules.slotStepMinutes, defaults.slotStepMinutes),
      minLeadMinutes: differs(input.rules.minLeadMinutes, defaults.minLeadMinutes),
      horizonDays: differs(input.rules.horizonDays, defaults.horizonDays),
      staffAssignment: differs(input.rules.staffAssignment, defaults.staffAssignment),
      clientChanges: {
        ...kept.clientChanges,
        cutoffMinutes: differs(
          input.rules.clientChangeCutoffMinutes,
          defaults.clientChanges.cutoffMinutes,
        ),
      },
      prepayment: {
        ...kept.prepayment,
        depositPercent: differs(input.rules.depositPercent, defaults.prepayment.depositPercent),
        holdMinutes: differs(input.rules.paymentHoldMinutes, defaults.prepayment.holdMinutes),
      },
      waitlist: {
        ...kept.waitlist,
        offerHoldMinutes: differs(
          input.rules.waitlistOfferHoldMinutes,
          defaults.waitlist.offerHoldMinutes,
        ),
      },
    });
    // Rejects combinations the engine cannot work with before anything is saved.
    resolveBookingRules(defaults, overrides);
    await this.directory.updateSettings(
      business.id,
      { name: input.name, rulesOverrides: overrides },
      new Date(this.clock.now().epochMilliseconds),
    );
    return this.get(businessId);
  }
}

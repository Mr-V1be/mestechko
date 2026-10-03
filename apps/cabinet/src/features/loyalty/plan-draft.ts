import type { PassPlan } from '@mestechko/contracts/client';
import type { CurrencyCode } from '@mestechko/domain';
import type { PassPlanBody } from '../../platform/api/loyalty-queries';
import { checkChosen, checkNumber, checkText, type FieldProblem } from '../common/field-checks';
import { toMajor, toMinor } from '../common/money';
import { loyaltyLimits, newPlanDefaults } from './limits';

/** A pass offer as it is being edited; cleared number fields are `null`. */
export interface PlanDraft {
  readonly name: string;
  readonly visits: number | null;
  readonly validityDays: number | null;
  /** Typed in major units, e.g. roubles. */
  readonly price: number | null;
  readonly serviceIds: readonly string[];
  readonly isActive: boolean;
}

export function planDraftOf(plan: PassPlan): PlanDraft {
  return {
    name: plan.name,
    visits: plan.visits,
    validityDays: plan.validityDays,
    price: toMajor(plan.price.amountMinor, plan.price.currency),
    serviceIds: [...plan.serviceIds],
    isActive: plan.isActive,
  };
}

export function newPlanDraft(): PlanDraft {
  return {
    name: '',
    visits: newPlanDefaults.visits,
    validityDays: newPlanDefaults.validityDays,
    price: null,
    serviceIds: [],
    isActive: true,
  };
}

export type PlanProblems = Readonly<
  Record<'name' | 'visits' | 'validityDays' | 'price' | 'serviceIds', FieldProblem | null>
>;

export function planProblemsOf(draft: PlanDraft): PlanProblems {
  return {
    name: checkText(draft.name, { required: true, max: loyaltyLimits.nameMax }),
    visits: checkNumber(draft.visits, {
      required: true,
      min: loyaltyLimits.visitsMin,
      max: loyaltyLimits.visitsMax,
    }),
    validityDays: checkNumber(draft.validityDays, {
      required: true,
      min: loyaltyLimits.validityMin,
      max: loyaltyLimits.validityMax,
    }),
    price: checkNumber(draft.price, { required: true, min: 0 }),
    serviceIds: checkChosen(draft.serviceIds),
  };
}

/** The body the API takes; call only for a draft without problems. */
export function planBodyFromDraft(draft: PlanDraft, currency: CurrencyCode): PassPlanBody {
  return {
    name: draft.name.trim(),
    visits: draft.visits ?? newPlanDefaults.visits,
    validityDays: draft.validityDays ?? newPlanDefaults.validityDays,
    priceMinor: toMinor(draft.price ?? 0, currency),
    serviceIds: [...draft.serviceIds],
    isActive: draft.isActive,
  };
}

export function samePlanDraft(a: PlanDraft, b: PlanDraft): boolean {
  return (
    JSON.stringify({ ...a, name: a.name.trim(), serviceIds: [...a.serviceIds].sort() }) ===
    JSON.stringify({ ...b, name: b.name.trim(), serviceIds: [...b.serviceIds].sort() })
  );
}

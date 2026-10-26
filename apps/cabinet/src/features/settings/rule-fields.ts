import type { BusinessRules } from '@slotwise/contracts/client';
import { bookingRuleLimits, isValidSlotStep } from '@slotwise/domain';
import { CalendarClock, CalendarSync, CreditCard, Hourglass, type LucideIcon } from 'lucide-react';

export type RuleKey = keyof BusinessRules;

/** Rules that are a number of something: minutes, days, percent. */
export type NumberRuleKey = {
  [K in RuleKey]: BusinessRules[K] extends number ? K : never;
}[RuleKey];

export type RuleUnit = 'minutes' | 'days' | 'percent';

export interface NumberRuleField {
  readonly kind: 'number';
  readonly key: NumberRuleKey;
  readonly unit: RuleUnit;
  readonly limits: { readonly min: number; readonly max: number };
}

/** Start times on a grid: offered as a choice of steps that divide a day. */
export interface StepRuleField {
  readonly kind: 'step';
  readonly key: 'slotStepMinutes';
}

/** How «any staff member» bookings pick someone: a strategy of the domain. */
export interface AssignmentRuleField {
  readonly kind: 'assignment';
  readonly key: 'staffAssignment';
}

export type RuleField = NumberRuleField | StepRuleField | AssignmentRuleField;

export interface RuleSection {
  readonly id: 'booking' | 'changes' | 'prepayment' | 'waitlist';
  readonly icon: LucideIcon;
  readonly fields: readonly RuleField[];
}

/** Steps people choose between; any other valid step the business already has stays listed. */
const COMMON_SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

/** The rules of the settings screen, grouped as the owner thinks of them. */
export const ruleSections: readonly RuleSection[] = [
  {
    id: 'booking',
    icon: CalendarClock,
    fields: [
      { kind: 'step', key: 'slotStepMinutes' },
      {
        kind: 'number',
        key: 'minLeadMinutes',
        unit: 'minutes',
        limits: bookingRuleLimits.minLeadMinutes,
      },
      {
        kind: 'number',
        key: 'horizonDays',
        unit: 'days',
        limits: bookingRuleLimits.horizonDays,
      },
      { kind: 'assignment', key: 'staffAssignment' },
    ],
  },
  {
    id: 'changes',
    icon: CalendarSync,
    fields: [
      {
        kind: 'number',
        key: 'clientChangeCutoffMinutes',
        unit: 'minutes',
        limits: bookingRuleLimits.changeCutoffMinutes,
      },
    ],
  },
  {
    id: 'prepayment',
    icon: CreditCard,
    fields: [
      {
        kind: 'number',
        key: 'depositPercent',
        unit: 'percent',
        limits: bookingRuleLimits.depositPercent,
      },
      {
        kind: 'number',
        key: 'paymentHoldMinutes',
        unit: 'minutes',
        limits: bookingRuleLimits.holdMinutes,
      },
    ],
  },
  {
    id: 'waitlist',
    icon: Hourglass,
    fields: [
      {
        kind: 'number',
        key: 'waitlistOfferHoldMinutes',
        unit: 'minutes',
        limits: bookingRuleLimits.holdMinutes,
      },
    ],
  },
];

export const numberRuleFields: readonly NumberRuleField[] = ruleSections.flatMap((section) =>
  section.fields.filter((field): field is NumberRuleField => field.kind === 'number'),
);

export function isNumberRule(key: RuleKey): key is NumberRuleKey {
  return numberRuleFields.some((field) => field.key === key);
}

/** Every rule the screen edits. */
export const ruleKeys: readonly RuleKey[] = ruleSections.flatMap((section) =>
  section.fields.map((field) => field.key),
);

/** Common steps plus the current and default ones, so nothing in use disappears. */
export function slotStepChoices(...inUse: readonly number[]): number[] {
  return [...new Set([...COMMON_SLOT_STEPS, ...inUse])]
    .filter((step) => isValidSlotStep(step))
    .sort((a, b) => a - b);
}

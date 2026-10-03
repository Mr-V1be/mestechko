import { ApiError, type BusinessRules, type BusinessSettings } from '@mestechko/contracts/client';
import type { SettingsChange } from '../../platform/api/settings-queries';
import { reasonOf } from '../common/error-message';
import { numberRuleFields, ruleKeys, type NumberRuleKey, type RuleKey } from './rule-fields';

/** Numbers are `null` while their field is empty. */
export type RulesDraft = {
  readonly [K in RuleKey]: BusinessRules[K] extends number ? number | null : BusinessRules[K];
};

export interface SettingsDraft {
  readonly name: string;
  readonly rules: RulesDraft;
}

export type FieldKey = 'name' | RuleKey;

/** Fields people type into; the choices offer only values the rules accept. */
export type TypedFieldKey = 'name' | NumberRuleKey;

export type FieldProblem =
  | { readonly kind: 'required' }
  | { readonly kind: 'range'; readonly min: number; readonly max: number }
  /** The API refused the value without saying more. */
  | { readonly kind: 'rejected' };

export type FieldProblems = ReadonlyMap<TypedFieldKey, FieldProblem>;

const RULES_REASON = 'invalid_booking_rules';
const BODY_PATH = /^body\.(?:rules\.)?(\w+)$/;
const typedFieldKeys: readonly TypedFieldKey[] = [
  'name',
  ...numberRuleFields.map((field) => field.key),
];

export function draftOf(settings: BusinessSettings): SettingsDraft {
  return { name: settings.name, rules: settings.rules };
}

/** Fields that differ from what is saved. */
export function changedFields(draft: SettingsDraft, saved: BusinessSettings): FieldKey[] {
  const rules = ruleKeys.filter((key) => draft.rules[key] !== saved.rules[key]);
  return draft.name.trim() === saved.name ? rules : ['name', ...rules];
}

/** Checks a draft against the limits the domain validates rules with. */
export function validateDraft(draft: SettingsDraft): FieldProblems {
  const problems = new Map<TypedFieldKey, FieldProblem>();
  if (draft.name.trim() === '') {
    problems.set('name', { kind: 'required' });
  }
  for (const field of numberRuleFields) {
    const value = draft.rules[field.key];
    if (value === null) {
      problems.set(field.key, { kind: 'required' });
    } else if (!Number.isInteger(value) || value < field.limits.min || value > field.limits.max) {
      problems.set(field.key, { kind: 'range', ...field.limits });
    }
  }
  return problems;
}

const isComplete = (rules: RulesDraft): rules is BusinessRules =>
  Object.values(rules).every((value) => value !== null);

/** What to send once the draft is valid. */
export function changeOf(draft: SettingsDraft): SettingsChange | null {
  if (validateDraft(draft).size > 0 || !isComplete(draft.rules)) {
    return null;
  }
  return { name: draft.name.trim(), rules: draft.rules };
}

const typedFieldOf = (path: unknown): TypedFieldKey | undefined => {
  const key = typeof path === 'string' ? BODY_PATH.exec(path)?.[1] : undefined;
  return typedFieldKeys.find((candidate) => candidate === key);
};

/**
 * Where a refused save went wrong: fields named by the API's schema check, or found by
 * the same limits when the domain refused the combination of rules. Anything that
 * cannot be pinned to a field is reported for the whole form.
 */
export function problemsOf(
  error: unknown,
  draft: SettingsDraft,
): { readonly fields: FieldProblems; readonly general: boolean } {
  if (!(error instanceof ApiError) || error.code !== 'validation_failed') {
    return { fields: new Map(), general: true };
  }
  const fields = new Map<TypedFieldKey, FieldProblem>();
  const issues: unknown[] = Array.isArray(error.details) ? error.details : [];
  for (const issue of issues) {
    const key = typedFieldOf(
      typeof issue === 'object' && issue !== null && 'path' in issue ? issue.path : undefined,
    );
    if (key) {
      fields.set(key, { kind: 'rejected' });
    }
  }
  if (reasonOf(error) === RULES_REASON) {
    for (const [key, problem] of validateDraft(draft)) {
      fields.set(key, problem);
    }
  }
  return { fields, general: fields.size === 0 };
}

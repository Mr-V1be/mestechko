import type { TFunction } from 'i18next';

/** What is wrong with a typed value, named by its `common:validation` text. */
export interface FieldProblem {
  readonly key: 'required' | 'tooLong' | 'range' | 'min' | 'chooseSome';
  readonly values?: Readonly<Record<string, number>>;
}

export interface TextRule {
  readonly required: boolean;
  readonly max: number;
}

export interface NumberRule {
  readonly required: boolean;
  readonly min: number;
  readonly max?: number;
}

export function checkText(value: string, rule: TextRule): FieldProblem | null {
  const trimmed = value.trim();
  if (rule.required && trimmed === '') {
    return { key: 'required' };
  }
  return trimmed.length > rule.max ? { key: 'tooLong', values: { max: rule.max } } : null;
}

export function checkNumber(value: number | null, rule: NumberRule): FieldProblem | null {
  if (value === null) {
    return rule.required ? { key: 'required' } : null;
  }
  if (rule.max !== undefined && (value < rule.min || value > rule.max)) {
    return { key: 'range', values: { min: rule.min, max: rule.max } };
  }
  return value < rule.min ? { key: 'min', values: { min: rule.min } } : null;
}

export function checkChosen(values: readonly unknown[]): FieldProblem | null {
  return values.length === 0 ? { key: 'chooseSome' } : null;
}

/** The message shown under a field, or `null` while the value is fine. */
export function problemText(t: TFunction, problem: FieldProblem | null | undefined): string | null {
  return problem ? t(`common:validation.${problem.key}`, problem.values ?? {}) : null;
}

/** Brings the first field with a problem into view, and into focus when it is a control. */
export function revealFirstProblem(form: HTMLFormElement | null): void {
  // The messages render on the next frame, after the check that found them.
  requestAnimationFrame(() => {
    const field = form?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    field?.scrollIntoView({ block: 'center' });
    if (field?.matches('[aria-invalid="true"]')) {
      field.focus({ preventScroll: true });
    }
  });
}

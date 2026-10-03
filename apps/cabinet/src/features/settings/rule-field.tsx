import { useFormat } from '@mestechko/booking-ui';
import type { BusinessRules } from '@mestechko/contracts/client';
import { staffAssignmentStrategyIds, type StaffAssignmentStrategyId } from '@mestechko/domain';
import { Button, NumberField, Select } from '@mestechko/ui';
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { slotStepChoices, type RuleField, type RuleKey, type RuleUnit } from './rule-fields';
import type { FieldProblem, RulesDraft } from './settings-draft';
import styles from './settings.module.css';

export interface RuleFieldProps {
  readonly field: RuleField;
  readonly rules: RulesDraft;
  readonly defaults: BusinessRules;
  readonly problem: FieldProblem | undefined;
  /** «Любой мастер» in the words of the business's vertical. */
  readonly staffAny: string;
  readonly onChange: <K extends RuleKey>(key: K, value: RulesDraft[K]) => void;
  readonly onTouched: () => void;
}

/** `60 мин`, `30 дней`, `10 %`. */
function useAmount() {
  const { t } = useTranslation();
  const format = useFormat();
  return (unit: RuleUnit, value: number) =>
    t(`settings:amount.${unit}`, { count: value, value: format.number(value) });
}

/** A field, the problem with its value, and the vertical's default it can return to. */
function RuleRow({
  control,
  defaultText,
  differs,
  onReset,
  onTouched,
}: {
  readonly control: ReactNode;
  readonly defaultText: string;
  readonly differs: boolean;
  readonly onReset: () => void;
  readonly onTouched: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.rule} onBlur={onTouched}>
      {control}
      <div className={styles.ruleMeta}>
        <span className={styles.ruleDefault}>{t('settings:default', { value: defaultText })}</span>
        {differs ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            aria-label={t('settings:resetLabel', { value: defaultText })}
            onClick={onReset}
          >
            {t('settings:reset')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RuleFieldControl({
  field,
  rules,
  defaults,
  problem,
  staffAny,
  onChange,
  onTouched,
}: RuleFieldProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const amount = useAmount();
  const label = t(`settings:rules.${field.key}`, { any: staffAny });
  const differs = rules[field.key] !== defaults[field.key];
  const reset = () => {
    onChange(field.key, defaults[field.key]);
  };

  if (field.kind === 'step') {
    const current = rules.slotStepMinutes;
    const fallback = defaults.slotStepMinutes;
    return (
      <RuleRow
        control={
          <Select
            label={label}
            value={String(current ?? fallback)}
            options={slotStepChoices(current ?? fallback, fallback).map((step) => ({
              value: String(step),
              label: format.duration(step),
            }))}
            onChange={(value) => {
              onChange('slotStepMinutes', Number(value));
            }}
          />
        }
        defaultText={format.duration(fallback)}
        differs={differs}
        onReset={reset}
        onTouched={onTouched}
      />
    );
  }

  if (field.kind === 'assignment') {
    return (
      <RuleRow
        control={
          <Select<StaffAssignmentStrategyId>
            label={label}
            value={rules.staffAssignment}
            options={staffAssignmentStrategyIds.map((id) => ({
              value: id,
              label: t(`settings:assignment.${id}`),
            }))}
            onChange={(value) => {
              onChange('staffAssignment', value);
            }}
          />
        }
        defaultText={t(`settings:assignment.${defaults.staffAssignment}`)}
        differs={differs}
        onReset={reset}
        onTouched={onTouched}
      />
    );
  }

  const error = !problem
    ? null
    : problem.kind === 'range'
      ? t('settings:errors.range', {
          min: format.number(problem.min),
          max: amount(field.unit, problem.max),
        })
      : t(`settings:errors.${problem.kind}`);
  return (
    <RuleRow
      control={
        <NumberField
          label={label}
          value={rules[field.key]}
          min={field.limits.min}
          max={field.limits.max}
          suffix={t(`settings:suffix.${field.unit}`)}
          error={error}
          onChange={(value) => {
            onChange(field.key, value);
          }}
        />
      }
      defaultText={amount(field.unit, defaults[field.key])}
      differs={differs}
      onReset={reset}
      onTouched={onTouched}
    />
  );
}

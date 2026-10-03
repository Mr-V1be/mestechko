import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './form.module.css';

const SECONDS_PER_MINUTE = 60;

/** Local wall times as `HH:MM`; an empty string while a time is not chosen. */
export interface TimeRange {
  readonly start: string;
  readonly end: string;
}

export interface TimeRangeFieldProps {
  /** What the range is, e.g. «Часы работы»; names the group for assistive technology. */
  readonly label: string;
  readonly hideLabel?: boolean;
  /** Accessible names of the two times, e.g. «Начало» and «Конец». */
  readonly startLabel: string;
  readonly endLabel: string;
  readonly value: TimeRange;
  readonly onChange: (value: TimeRange) => void;
  /** Validation message under the range; marks both times invalid. */
  readonly error?: string | null;
  /** Minutes between the times the picker offers. */
  readonly stepMinutes?: number;
  /** An action at the end of the row, e.g. removing this range. */
  readonly action?: ReactNode;
  readonly disabled?: boolean;
}

/** A span of the day from one time to another, typed or picked with the system picker. */
export function TimeRangeField({
  label,
  hideLabel = false,
  startLabel,
  endLabel,
  value,
  onChange,
  error,
  stepMinutes = 5,
  action,
  disabled = false,
}: TimeRangeFieldProps) {
  const invalid = Boolean(error);
  const time = (part: keyof TimeRange, partLabel: string) => (
    <Field.Root className={styles.rangePart} invalid={invalid} disabled={disabled}>
      <Field.Label className="visually-hidden">{partLabel}</Field.Label>
      <Field.Control
        type="time"
        className={styles.input}
        value={value[part]}
        step={stepMinutes * SECONDS_PER_MINUTE}
        onChange={(event) => {
          onChange({ ...value, [part]: event.currentTarget.value });
        }}
      />
    </Field.Root>
  );
  return (
    <Fieldset.Root className={clsx(styles.field, styles.fieldset)} disabled={disabled}>
      <Fieldset.Legend className={clsx(styles.label, hideLabel && 'visually-hidden')}>
        {label}
      </Fieldset.Legend>
      <div className={styles.range}>
        {time('start', startLabel)}
        <span className={styles.rangeDash} aria-hidden="true">
          –
        </span>
        {time('end', endLabel)}
        {action ? <span className={styles.rangeAction}>{action}</span> : null}
      </div>
      {invalid ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Fieldset.Root>
  );
}

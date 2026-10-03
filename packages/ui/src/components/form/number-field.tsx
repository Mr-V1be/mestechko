import { Field } from '@base-ui/react/field';
import { clsx } from 'clsx';
import { useState, type ReactNode } from 'react';
import styles from './form.module.css';

export interface NumberFieldProps {
  readonly label: ReactNode;
  readonly hideLabel?: boolean;
  /** `null` while the field is empty. */
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly min?: number;
  readonly max?: number;
  /** Unit after the number: «мин», «₽», «%». */
  readonly suffix?: ReactNode;
  readonly placeholder?: string;
  readonly description?: ReactNode;
  readonly error?: string | null;
  /** Digits after the decimal separator people may type, e.g. kopecks. */
  readonly fractionDigits?: number;
  readonly className?: string | undefined;
}

const parse = (text: string): number | null => {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

/** A whole or decimal number with its unit; checks the range where it is typed. */
export function NumberField({
  label,
  hideLabel = false,
  value,
  onChange,
  min,
  max,
  suffix,
  placeholder,
  description,
  error,
  fractionDigits = 0,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value).replace('.', ','));
  const invalid = Boolean(error);
  return (
    <Field.Root className={clsx(styles.field, className)} invalid={invalid}>
      <Field.Label className={clsx(styles.label, hideLabel && 'visually-hidden')}>
        {label}
      </Field.Label>
      <div className={styles.affixed}>
        <Field.Control
          className={clsx(styles.input, styles.number)}
          inputMode={fractionDigits > 0 ? 'decimal' : 'numeric'}
          value={shown}
          placeholder={placeholder}
          aria-valuemin={min}
          aria-valuemax={max}
          onChange={(event) => {
            const text = event.currentTarget.value;
            setDraft(text);
            const parsed = parse(text);
            const factor = 10 ** fractionDigits;
            onChange(parsed === null ? null : Math.round(parsed * factor) / factor);
          }}
          onBlur={() => {
            setDraft(null);
          }}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {description && !invalid ? (
        <Field.Description className={styles.description}>{description}</Field.Description>
      ) : null}
      {invalid ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Field.Root>
  );
}

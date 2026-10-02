import { Field } from '@base-ui/react/field';
import { clsx } from 'clsx';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './form.module.css';

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'className'> {
  readonly label: ReactNode;
  /** Keeps the label for assistive technology only, e.g. in a chat composer. */
  readonly hideLabel?: boolean;
  readonly description?: ReactNode;
  /** Validation message shown under the field; marks the field invalid. */
  readonly error?: string | null;
  readonly multiline?: boolean;
}

export function TextField({
  label,
  hideLabel = false,
  description,
  error,
  multiline = false,
  ...input
}: TextFieldProps) {
  const invalid = Boolean(error);
  return (
    <Field.Root className={styles.field} invalid={invalid}>
      <Field.Label className={clsx(styles.label, hideLabel && 'visually-hidden')}>
        {label}
      </Field.Label>
      <Field.Control
        {...input}
        render={multiline ? <textarea /> : undefined}
        className={styles.input}
      />
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

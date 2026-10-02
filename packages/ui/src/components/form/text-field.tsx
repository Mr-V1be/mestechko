import { Field } from '@base-ui/react/field';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './form.module.css';

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'className'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** Validation message shown under the field; marks the field invalid. */
  readonly error?: string | null;
  readonly multiline?: boolean;
}

export function TextField({
  label,
  description,
  error,
  multiline = false,
  ...input
}: TextFieldProps) {
  const invalid = Boolean(error);
  return (
    <Field.Root className={styles.field} invalid={invalid}>
      <Field.Label className={styles.label}>{label}</Field.Label>
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

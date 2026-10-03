import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { useId, type ReactNode } from 'react';
import styles from './form.module.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
}

/** On or off, with the label that says what. */
export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <label htmlFor={id} className={styles.switchText}>
        <span className={styles.label}>{label}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </label>
      <BaseSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled ?? false}
        onCheckedChange={(next) => {
          onCheckedChange(next);
        }}
        className={styles.switch}
      >
        <BaseSwitch.Thumb className={styles.switchThumb} />
      </BaseSwitch.Root>
    </div>
  );
}

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';
import styles from './form.module.css';

export interface CheckboxProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** Accessible name when no visible label is associated. */
  readonly label?: string;
  readonly id?: string;
}

export function Checkbox({ checked, onCheckedChange, label, id }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(next) => {
        onCheckedChange(next);
      }}
      aria-label={label}
      className={styles.checkbox}
    >
      <BaseCheckbox.Indicator>
        <Check />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}

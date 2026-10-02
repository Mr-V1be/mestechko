import { Select as BaseSelect } from '@base-ui/react/select';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './form.module.css';

export interface SelectOption<V extends string> {
  readonly value: V;
  readonly label: string;
  /** Optional leading visual, e.g. an avatar. */
  readonly leading?: ReactNode;
}

export interface SelectProps<V extends string> {
  /** Accessible name; visible above the control unless `hideLabel`. */
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly value: V;
  readonly options: readonly SelectOption<V>[];
  readonly onChange: (value: V) => void;
  readonly className?: string | undefined;
}

/** Choice of one option from many. */
export function Select<V extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  className,
}: SelectProps<V>) {
  const selected = options.find((option) => option.value === value);
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) {
          onChange(option.value);
        }
      }}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
    >
      <div className={clsx(styles.field, className)}>
        <BaseSelect.Label className={clsx(styles.label, hideLabel && 'visually-hidden')}>
          {label}
        </BaseSelect.Label>
        <BaseSelect.Trigger className={styles.trigger}>
          {selected?.leading}
          <BaseSelect.Value className={styles.triggerValue} />
          <BaseSelect.Icon className={styles.triggerIcon}>
            <ChevronDown />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          style={{ zIndex: 'var(--layer-popover)' }}
        >
          <BaseSelect.Popup className={styles.popup}>
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item key={option.value} value={option.value} className={styles.item}>
                  {option.leading}
                  <BaseSelect.ItemText className={styles.itemText}>
                    {option.label}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className={styles.itemIndicator}>
                    <Check />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

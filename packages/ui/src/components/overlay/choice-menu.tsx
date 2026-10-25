import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../button/button';
import styles from './overlay.module.css';

export interface ChoiceMenuOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Language of the label when it differs from the page, e.g. a language's own name. */
  readonly lang?: string;
}

export interface ChoiceMenuProps<T extends string> {
  /** What is being chosen; the button's accessible name. */
  readonly label: string;
  readonly icon: ReactNode;
  /** Short text on the button for the current choice, e.g. `EN`. */
  readonly current: string;
  readonly value: T;
  readonly options: readonly ChoiceMenuOption<T>[];
  readonly onChange: (value: T) => void;
}

/** One of a few options from a compact button, e.g. the language in a header. */
export function ChoiceMenu<T extends string>({
  label,
  icon,
  current,
  value,
  options,
  onChange,
}: ChoiceMenuProps<T>) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        render={
          <Button variant="ghost" size="sm" icon={icon} aria-label={`${label}: ${current}`}>
            {current}
          </Button>
        }
      />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" style={{ zIndex: 'var(--layer-popover)' }}>
          <BaseMenu.Popup className={styles.menuPopup} aria-label={label}>
            <BaseMenu.RadioGroup
              value={value}
              onValueChange={(next: T) => {
                onChange(next);
              }}
            >
              {options.map((option) => (
                <BaseMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  closeOnClick
                  className={styles.menuItem}
                  lang={option.lang}
                >
                  <span className={styles.menuChoice}>{option.label}</span>
                  <BaseMenu.RadioItemIndicator className={styles.menuChoiceMark}>
                    <Check aria-hidden="true" />
                  </BaseMenu.RadioItemIndicator>
                </BaseMenu.RadioItem>
              ))}
            </BaseMenu.RadioGroup>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

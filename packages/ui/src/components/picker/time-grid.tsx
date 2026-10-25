import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { CSSProperties } from 'react';
import styles from './picker.module.css';

export interface TimeGridGroup {
  readonly key: string;
  readonly title: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export interface TimeGridProps {
  readonly label: string;
  readonly groups: readonly TimeGridGroup[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
}

/** Free start times as seats to pick; arrow keys move between them. */
export function TimeGrid({ label, groups, value, onChange }: TimeGridProps) {
  const longest = Math.max(
    0,
    ...groups.flatMap((group) => group.options.map((option) => option.label.length)),
  );
  const sizing = { '--slot-label-length': longest } as CSSProperties;
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        if (typeof next === 'string' && next !== '') {
          onChange(next);
        }
      }}
      className={styles.timeGrid}
    >
      {groups.map((group) => (
        <div key={group.key} role="group" aria-label={group.title}>
          <p className={styles.groupTitle} aria-hidden="true">
            {group.title}
          </p>
          <div className={styles.slots} style={sizing}>
            {group.options.map((option) => (
              <Radio.Root key={option.value} value={option.value} className={styles.slot}>
                {option.label}
              </Radio.Root>
            ))}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { clsx } from 'clsx';
import styles from './picker.module.css';

export interface DateStripDay {
  readonly value: string;
  readonly weekday: string;
  readonly dayNumber: string;
  /** Full date for assistive technology, e.g. "вторник, 6 октября". */
  readonly accessibleLabel: string;
  readonly disabled: boolean;
  /** A dot under the day, e.g. "has free time". */
  readonly marked: boolean;
  readonly today: boolean;
}

export interface DateStripProps {
  readonly label: string;
  readonly days: readonly DateStripDay[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
}

/** A week of days to choose from; days without free time are disabled. */
export function DateStrip({ label, days, value, onChange }: DateStripProps) {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        if (typeof next === 'string' && next !== '') {
          onChange(next);
        }
      }}
      className={styles.dateStrip}
    >
      {days.map((day) => (
        <Radio.Root
          key={day.value}
          value={day.value}
          disabled={day.disabled}
          aria-label={day.accessibleLabel}
          className={clsx(styles.day, day.marked && styles.marked, day.today && styles.today)}
        >
          <span className={styles.weekday} aria-hidden="true">
            {day.weekday}
          </span>
          <span className={styles.dayNumber} aria-hidden="true">
            {day.dayNumber}
          </span>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

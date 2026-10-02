import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './form.module.css';

export interface Segment<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly icon?: ReactNode;
}

export interface SegmentedControlProps<V extends string> {
  readonly label: string;
  readonly value: V;
  readonly segments: readonly Segment<V>[];
  readonly onChange: (value: V) => void;
  /** Stretches segments to the full width. */
  readonly block?: boolean;
}

/** Two or three short, mutually exclusive modes of the same view. */
export function SegmentedControl<V extends string>({
  label,
  value,
  segments,
  onChange,
  block = false,
}: SegmentedControlProps<V>) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const chosen = segments.find((segment) => next.includes(segment.value));
        if (chosen) {
          onChange(chosen.value);
        }
      }}
      className={clsx(styles.segmented, block && styles.segmentedBlock)}
    >
      {segments.map((segment) => (
        <Toggle key={segment.value} value={segment.value} className={styles.segment}>
          {segment.icon}
          {segment.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

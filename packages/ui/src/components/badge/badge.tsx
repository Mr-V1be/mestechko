import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './badge.module.css';

export const badgeTones = {
  neutral: styles.neutral,
  accent: styles.accent,
  success: styles.success,
  danger: styles.danger,
  outline: styles.outline,
} as const;

export type BadgeTone = keyof typeof badgeTones;

export interface BadgeProps {
  readonly tone?: BadgeTone;
  /** Leading dot, e.g. for statuses. */
  readonly dot?: boolean;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, badgeTones[tone], dot && styles.dot, className)}>
      {children}
    </span>
  );
}

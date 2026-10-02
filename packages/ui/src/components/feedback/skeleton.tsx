import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import styles from './feedback.module.css';

const shapes = { block: undefined, circle: styles.circle, text: styles.text } as const;

export interface SkeletonProps {
  readonly shape?: keyof typeof shapes;
  /** Any CSS length or token reference, e.g. `var(--size-avatar-md)` or `60%`. */
  readonly width?: string;
  readonly height?: string;
  readonly className?: string | undefined;
}

/** Placeholder in the shape of content that is still loading. */
export function Skeleton({ shape = 'block', width, height, className }: SkeletonProps) {
  const style: CSSProperties = { width, height };
  return (
    <span
      className={clsx(styles.skeleton, shapes[shape], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

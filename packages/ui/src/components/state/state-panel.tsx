import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './state-panel.module.css';

export interface StatePanelProps {
  readonly illustration?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The one action that moves the person forward. */
  readonly action?: ReactNode;
  readonly compact?: boolean;
  /** `alert` for errors so assistive technology announces them. */
  readonly role?: 'status' | 'alert';
}

/** Empty, error and no-access states: what happened and what to do next. */
export function StatePanel({
  illustration,
  title,
  description,
  action,
  compact = false,
  role = 'status',
}: StatePanelProps) {
  return (
    <div className={clsx(styles.panel, compact && styles.compact)} role={role}>
      {illustration ? <div className={styles.illustration}>{illustration}</div> : null}
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

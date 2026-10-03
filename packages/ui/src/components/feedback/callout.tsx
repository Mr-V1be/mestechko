import type { ReactNode } from 'react';
import styles from './callout.module.css';

export interface CalloutProps {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  /** What it means and what happens next, in a sentence or two. */
  readonly children?: ReactNode;
  /** The step it asks for, e.g. a quiet secondary button. */
  readonly actions?: ReactNode;
}

/**
 * Something that waits for the person, set apart from the content around it: a time
 * held until a payment, an offer to answer. Changes are announced politely.
 */
export function Callout({ icon, title, children, actions }: CalloutProps) {
  return (
    <section className={styles.callout} aria-live="polite">
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}

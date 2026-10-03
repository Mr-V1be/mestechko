import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';
import styles from './member.module.css';

/** A titled part of the person's page with its one action. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  readonly title: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const titleId = useId();
  return (
    <section className={clsx(styles.section, className)} aria-labelledby={titleId}>
      <header className={styles.sectionHeader}>
        <h2 id={titleId} className={styles.sectionTitle}>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

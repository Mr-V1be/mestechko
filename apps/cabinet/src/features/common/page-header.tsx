import type { ReactNode } from 'react';
import styles from './common.module.css';

export function PageHeader({
  title,
  actions,
}: {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {actions}
    </header>
  );
}

export function PageContainer({ children }: { readonly children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}

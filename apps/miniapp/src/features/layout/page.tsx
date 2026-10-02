import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { useBackButton } from '../../platform/telegram/sdk-buttons';
import { useGoBack } from './go-back';
import styles from './layout.module.css';

export interface PageProps {
  readonly title?: ReactNode;
  readonly lead?: ReactNode;
  /** Parent screen for the Telegram back button; omit on root screens. */
  readonly backTo?: string | undefined;
  /** Summary shown beside the content on wide screens. */
  readonly aside?: ReactNode;
  /** Compact summary pinned above the main button on narrow screens. */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function Page({ title, lead, backTo, aside, footer, children }: PageProps) {
  const goBack = useGoBack(backTo ?? '/');
  useBackButton(backTo === undefined ? null : goBack);
  return (
    <div className={styles.container}>
      <div className={clsx(styles.columns, aside !== undefined && styles.withAside)}>
        <main className={styles.main}>
          {title ? (
            <header className={styles.heading}>
              <h1 className={styles.title}>{title}</h1>
              {lead ? <p className={styles.lead}>{lead}</p> : null}
            </header>
          ) : null}
          {children}
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </main>
        {aside !== undefined ? <aside className={styles.aside}>{aside}</aside> : null}
      </div>
    </div>
  );
}

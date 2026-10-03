import type { ReactNode } from 'react';
import styles from './clients.module.css';

/** A refusal that concerns the whole form rather than one field, read out when it appears. */
export function FormFailure({ children }: { readonly children: ReactNode }) {
  return (
    <p className={styles.failure} role="alert">
      {children}
    </p>
  );
}

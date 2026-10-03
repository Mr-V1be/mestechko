import { clsx } from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './data.module.css';

export interface StatTileProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly icon?: ReactNode;
  /** Change against the previous period; `good` says whether it is welcome. */
  readonly delta?: {
    readonly text: string;
    readonly direction: 'up' | 'down' | 'flat';
    readonly good: boolean | null;
  } | null;
  readonly hint?: ReactNode;
}

const arrows = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/** One key figure with its trend. */
export function StatTile({ label, value, icon, delta, hint }: StatTileProps) {
  const Arrow = delta ? arrows[delta.direction] : null;
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>
        {icon ? <span className={styles.tileIcon}>{icon}</span> : null}
        {label}
      </div>
      <div className={styles.tileValue}>{value}</div>
      {delta && Arrow ? (
        <div
          className={clsx(
            styles.tileDelta,
            delta.good === true && styles.good,
            delta.good === false && styles.bad,
          )}
        >
          <Arrow aria-hidden="true" />
          {delta.text}
        </div>
      ) : null}
      {hint ? <div className={styles.tileHint}>{hint}</div> : null}
    </div>
  );
}

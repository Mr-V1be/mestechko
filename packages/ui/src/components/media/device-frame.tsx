import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './device-frame.module.css';

export type DeviceKind = 'phone' | 'laptop' | 'browser';

export interface DeviceFrameProps {
  readonly kind: DeviceKind;
  /** What the device shows: a live screen, a screenshot or a video. */
  readonly children: ReactNode;
  /** The address in a browser window's bar. */
  readonly address?: string;
  /** Size and placement come from the place it is used. */
  readonly className?: string | undefined;
}

/**
 * A screen of the product inside the device it is used on: a phone, a laptop or a
 * browser window. Only the frame is drawn here; the screen keeps its own content.
 */
export function DeviceFrame({ kind, children, address, className }: DeviceFrameProps) {
  if (kind === 'laptop') {
    return (
      <div className={clsx(styles.laptop, className)}>
        <div className={styles.laptopLid}>
          <div className={styles.screen}>{children}</div>
        </div>
        <div className={styles.laptopBase} aria-hidden="true" />
      </div>
    );
  }
  if (kind === 'browser') {
    return (
      <div className={clsx(styles.browser, className)}>
        <div className={styles.browserBar} aria-hidden="true">
          <span className={styles.dots}>
            <span />
            <span />
            <span />
          </span>
          {address ? <span className={styles.address}>{address}</span> : null}
        </div>
        <div className={styles.browserScreen}>{children}</div>
      </div>
    );
  }
  return (
    <div className={clsx(styles.phone, className)}>
      <div className={styles.phoneScreen}>{children}</div>
    </div>
  );
}

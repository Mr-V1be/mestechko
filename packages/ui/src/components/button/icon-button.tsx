import { clsx } from 'clsx';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Tooltip } from '../overlay/tooltip';
import styles from './button.module.css';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name, also shown as a tooltip on pointer devices. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly soft?: boolean;
}

/** Icon-only button for universally understood actions (close, back, more, search). */
export function IconButton({
  label,
  icon,
  soft = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type={type}
        aria-label={label}
        className={clsx(styles.iconButton, soft && styles.iconButtonSoft, className)}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

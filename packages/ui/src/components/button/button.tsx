import { clsx } from 'clsx';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Spinner } from '../feedback/spinner';
import styles from './button.module.css';

const variants = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
} as const;

const sizes = { sm: styles.sm, md: undefined, lg: styles.lg } as const;

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  readonly variant?: keyof typeof variants;
  readonly size?: keyof typeof sizes;
  /** Stretches to the width of the container. */
  readonly block?: boolean;
  /** Keeps the size, shows progress and blocks repeated presses. */
  readonly loading?: boolean;
  readonly icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        styles.button,
        variants[variant],
        sizes[size],
        block && styles.block,
        loading && styles.loading,
        className,
      )}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.content}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children}
      </span>
      {loading ? (
        <span className={styles.spinner}>
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}

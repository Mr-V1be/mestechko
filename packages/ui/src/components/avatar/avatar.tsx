import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './avatar.module.css';

const sizes = { sm: styles.sm, md: styles.md, lg: styles.lg, xl: styles.xl } as const;

export interface AvatarProps {
  readonly name: string;
  readonly src?: string | null;
  readonly size?: keyof typeof sizes;
  readonly shape?: 'round' | 'square';
  /** Shown instead of initials when there is no image, e.g. an icon. */
  readonly fallback?: ReactNode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, src, size = 'md', shape = 'round', fallback }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={clsx(styles.avatar, sizes[size], shape === 'square' && styles.square)}
    >
      {src ? <BaseAvatar.Image className={styles.image} src={src} alt="" loading="lazy" /> : null}
      <BaseAvatar.Fallback aria-label={name}>{fallback ?? initials(name)}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}

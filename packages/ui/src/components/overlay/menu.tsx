import { Menu as BaseMenu } from '@base-ui/react/menu';
import { clsx } from 'clsx';
import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../button/icon-button';
import styles from './overlay.module.css';

interface MenuActionBase {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly tone?: 'default' | 'danger';
  readonly disabled?: boolean;
}

/** An action runs `onSelect`; a link action is followed by the browser, e.g. a download. */
export type MenuAction = MenuActionBase &
  (
    | { readonly onSelect: () => void; readonly href?: never }
    | {
        readonly href: string;
        /** Saves the target as a file instead of opening it. */
        readonly download?: boolean;
        /** Runs as the link is followed, e.g. to confirm the download started. */
        readonly onSelect?: () => void;
      }
  );

export interface MenuProps {
  /** Accessible name of the «⋯» button. */
  readonly label: string;
  readonly actions: readonly MenuAction[];
  readonly icon?: ReactNode;
}

/** Rare or secondary actions behind a «⋯» button. */
export function Menu({ label, actions, icon = <Ellipsis /> }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={<IconButton label={label} icon={icon} soft />} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" style={{ zIndex: 'var(--layer-popover)' }}>
          <BaseMenu.Popup className={styles.menuPopup}>
            {actions.map((action) => {
              const className = clsx(styles.menuItem, action.tone === 'danger' && styles.menuDanger);
              return action.href === undefined ? (
                <BaseMenu.Item
                  key={action.key}
                  disabled={action.disabled ?? false}
                  className={className}
                  onClick={action.onSelect}
                >
                  {action.icon}
                  {action.label}
                </BaseMenu.Item>
              ) : (
                <BaseMenu.LinkItem
                  key={action.key}
                  href={action.href}
                  download={action.download ?? undefined}
                  closeOnClick
                  className={className}
                  onClick={action.onSelect}
                >
                  {action.icon}
                  {action.label}
                </BaseMenu.LinkItem>
              );
            })}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

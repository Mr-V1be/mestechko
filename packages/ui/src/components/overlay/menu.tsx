import { Menu as BaseMenu } from '@base-ui/react/menu';
import { clsx } from 'clsx';
import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../button/icon-button';
import styles from './overlay.module.css';

export interface MenuAction {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  readonly tone?: 'default' | 'danger';
  readonly disabled?: boolean;
}

export interface MenuProps {
  /** Accessible name of the «⋯» button. */
  readonly label: string;
  readonly actions: readonly MenuAction[];
  readonly icon?: ReactNode;
  /** A tinted button stands alone; a plain one sits quietly in rows of a list. */
  readonly soft?: boolean;
}

/** Rare or secondary actions behind a «⋯» button. */
export function Menu({ label, actions, icon = <Ellipsis />, soft = true }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={<IconButton label={label} icon={icon} soft={soft} />} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="end" style={{ zIndex: 'var(--layer-popover)' }}>
          <BaseMenu.Popup className={styles.menuPopup}>
            {actions.map((action) => (
              <BaseMenu.Item
                key={action.key}
                disabled={action.disabled ?? false}
                className={clsx(styles.menuItem, action.tone === 'danger' && styles.menuDanger)}
                onClick={action.onSelect}
              >
                {action.icon}
                {action.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement } from 'react';
import styles from './overlay.module.css';

const TOOLTIP_OFFSET = 8;

export interface TooltipProps {
  readonly label: string;
  readonly children: ReactElement<Record<string, unknown>>;
}

/** Hover and focus hint for pointer devices; the trigger keeps its own accessible name. */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          sideOffset={TOOLTIP_OFFSET}
          style={{ zIndex: 'var(--layer-popover)' }}
        >
          <BaseTooltip.Popup className={styles.tooltip}>{label}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

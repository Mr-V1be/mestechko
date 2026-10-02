import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../button/icon-button';
import styles from './overlay.module.css';

export interface SheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly closeLabel: string;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** Details and secondary tasks: a bottom sheet on phones, a side panel on larger screens. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  footer,
  children,
}: SheetProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.sheet}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            <div className={styles.sheetTitle}>
              <Dialog.Title render={<h2 />}>{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className={styles.sheetDescription}>
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close render={<IconButton label={closeLabel} icon={<X />} soft />} />
          </div>
          <div className={styles.sheetBody}>{children}</div>
          {footer ? <div className={styles.sheetFooter}>{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

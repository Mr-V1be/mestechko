import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button } from '../button/button';
import { IconButton } from '../button/icon-button';
import styles from './overlay.module.css';

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly closeLabel: string;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
}

const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * A focused task or decision: centred on larger screens, a bottom sheet on phones so
 * its buttons stay within thumb reach. Opening focuses the first control of the task,
 * never the close button; without one, or on touch, the dialog itself.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  footer,
  children,
}: DialogProps) {
  const popup = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Popup
          ref={popup}
          // A touch opens no keyboard on its own: the dialog itself takes focus then.
          initialFocus={(openType) =>
            (openType === 'touch'
              ? null
              : content.current?.querySelector<HTMLElement>(FOCUSABLE)) ?? popup.current
          }
          className={styles.dialog}
        >
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            <div className={styles.sheetTitle}>
              <BaseDialog.Title render={<h2 />}>{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className={styles.sheetDescription}>
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close render={<IconButton label={closeLabel} icon={<X />} soft />} />
          </div>
          <div ref={content} className={styles.dialogContent}>
            {children ? <div className={styles.sheetBody}>{children}</div> : null}
            {footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: ReactNode;
  /** What will happen, in concrete terms: «Затронет 3 записи», not «Вы уверены?». */
  readonly consequence: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly closeLabel: string;
  readonly onConfirm: () => void;
  readonly tone?: 'primary' | 'danger';
  readonly pending?: boolean;
  /** Details of the consequence, e.g. the visits affected. */
  readonly children?: ReactNode;
}

/** A consequential action asks once, naming its consequences. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  tone = 'primary',
  pending = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={consequence}
      closeLabel={closeLabel}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button variant={tone} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

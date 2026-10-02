import { Toast } from '@base-ui/react/toast';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './overlay.module.css';

const toastIcons = {
  success: <CircleCheck />,
  error: <CircleAlert />,
} as const;

export type ToastTone = keyof typeof toastIcons;

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={styles.toast}>
      <span className={styles.toastIcon} aria-hidden="true">
        {toastIcons[(toast.type as ToastTone | undefined) ?? 'success']}
      </span>
      <div className={styles.toastText}>
        <Toast.Title className={styles.toastTitle} />
        <Toast.Description className={styles.toastDescription} />
      </div>
    </Toast.Root>
  ));
}

/** Short, non-blocking feedback about the result of an action. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <Toast.Portal>
        <Toast.Viewport className={styles.toastViewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export function useToast() {
  const manager = Toast.useToastManager();
  return {
    show(input: {
      readonly title: string;
      readonly description?: string;
      readonly tone?: ToastTone;
    }) {
      manager.add({
        title: input.title,
        description: input.description,
        type: input.tone ?? 'success',
      });
    },
  };
}

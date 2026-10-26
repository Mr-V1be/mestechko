import { errorMessage } from '@slotwise/booking-ui';
import { Button, EmptyIllustration, ErrorIllustration, Skeleton, StatePanel } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import styles from './layout.module.css';

/** Placeholder rows in the shape of a list while it loads. */
export function ListSkeleton({ rows = 4 }: { readonly rows?: number }) {
  return (
    <div className={styles.skeletonStack} aria-busy="true" aria-live="polite">
      <Skeleton shape="text" width="40%" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height="var(--size-control-lg)" />
      ))}
    </div>
  );
}

export function QueryErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <StatePanel
      role="alert"
      illustration={<ErrorIllustration />}
      title={t('common:states.errorTitle')}
      description={errorMessage(t, error)}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:actions.retry')}
        </Button>
      }
    />
  );
}

export function NotFoundState({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <StatePanel illustration={<EmptyIllustration />} title={title} description={description} />
  );
}

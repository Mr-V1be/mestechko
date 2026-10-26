import { Button, ErrorIllustration, LockedIllustration, Skeleton, StatePanel } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { errorMessage, isForbidden } from './error-message';
import styles from './common.module.css';

export function QueryErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (isForbidden(error)) {
    return <NoAccessState />;
  }
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

export function NoAccessState() {
  const { t } = useTranslation();
  return (
    <StatePanel
      illustration={<LockedIllustration />}
      title={t('access.title')}
      description={t('access.description')}
    />
  );
}

export function FullScreenLoading() {
  return (
    <div className={styles.fullScreen} aria-busy="true">
      <Skeleton shape="circle" width="var(--size-avatar-md)" height="var(--size-avatar-md)" />
      <Skeleton shape="text" width="var(--size-illustration)" />
    </div>
  );
}

export function RouteErrorPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <StatePanel
        role="alert"
        illustration={<ErrorIllustration />}
        title={t('crash.title')}
        description={t('crash.description')}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('crash.reload')}
          </Button>
        }
      />
    </div>
  );
}

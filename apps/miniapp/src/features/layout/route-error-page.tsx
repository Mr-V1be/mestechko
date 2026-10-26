import { Button, ErrorIllustration, StatePanel } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import styles from './layout.module.css';

/** Last resort for unexpected failures inside a screen. */
export function RouteErrorPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
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

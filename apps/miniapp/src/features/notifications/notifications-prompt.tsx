import { Button } from '@mestechko/ui';
import { openTelegramLink } from '@tma.js/sdk-react';
import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationStatus } from '../../platform/api/lifecycle-queries';
import styles from './notifications.module.css';

/**
 * The bot may write only to people who started it: until the client does, this card
 * offers to turn reminders on in one tap.
 */
export function NotificationsPrompt() {
  const { t } = useTranslation();
  const status = useNotificationStatus();
  const url = status.data?.connectUrl;
  if (!url || status.data?.enabled) {
    return null;
  }
  return (
    <section className={styles.prompt} aria-labelledby="notifications-title">
      <span className={styles.icon} aria-hidden="true">
        <BellRing />
      </span>
      <div className={styles.text}>
        <h2 id="notifications-title" className={styles.title}>
          {t('notifications.title')}
        </h2>
        <p className={styles.description}>{t('notifications.description')}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          openTelegramLink.ifAvailable(url);
        }}
      >
        {t('notifications.enable')}
      </Button>
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import { NotFoundState } from './states';
import styles from './layout.module.css';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <NotFoundState
        title={t('common:states.notFoundTitle')}
        description={t('business.missingDescription')}
      />
    </div>
  );
}

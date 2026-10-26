import { brandName } from '@slotwise/i18n';
import { Logo } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import styles from './chrome.module.css';

/** The year comes from the build: the prerendered page and the live one agree. */
const BUILD_YEAR = new Date().getFullYear();

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Logo name={brandName} />
        <p className={styles.footerText}>{t('footer.demo')}</p>
        <p className={styles.footerText}>{t('footer.rights', { year: BUILD_YEAR })}</p>
      </div>
    </footer>
  );
}

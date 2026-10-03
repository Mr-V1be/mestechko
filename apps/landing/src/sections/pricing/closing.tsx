import { Button, LogoMark } from '@mestechko/ui';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../../app/config';
import styles from './closing.module.css';

/** The last word: the demo to try and the bot to open. */
export function Closing({ onDemo }: { readonly onDemo: () => void }) {
  const { t } = useTranslation();
  return (
    <section className={styles.closing}>
      <div className={styles.inner}>
        <LogoMark className={styles.mark} tone="inverse" />
        <h2 className={styles.title}>{t('closing.title')}</h2>
        <p className={styles.lead}>{t('closing.lead')}</p>
        <div className={styles.actions}>
          <Button size="lg" variant="secondary" onClick={onDemo}>
            {t('nav.demo')}
          </Button>
          <a className={styles.bot} href={siteConfig.botUrl} target="_blank" rel="noopener">
            <Send aria-hidden="true" />
            {t('closing.bot')}
          </a>
        </div>
      </div>
    </section>
  );
}

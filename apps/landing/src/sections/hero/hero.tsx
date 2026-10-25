import { Button, DeviceFrame } from '@mestechko/ui';
import { Send, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../../app/config';
import { useSiteMedia } from '../../media/use-media';
import { ThemedImage } from '../../media/themed-image';
import styles from './hero.module.css';

/** The first screen: the question the product answers and the product itself. */
export function Hero({ onDemo }: { readonly onDemo: () => void }) {
  const { t } = useTranslation();
  const { shots } = useSiteMedia();
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <Sparkles aria-hidden="true" />
            {t('hero.eyebrow')}
          </p>
          <h1 className={styles.title}>{t('hero.title')}</h1>
          <p className={styles.lead}>{t('hero.lead')}</p>
          <div className={styles.actions}>
            <Button size="lg" onClick={onDemo}>
              {t('hero.demo')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon={<Send />}
              onClick={() => {
                window.open(siteConfig.botUrl, '_blank', 'noopener');
              }}
            >
              {t('hero.bot')}
            </Button>
          </div>
          <p className={styles.note}>{t('hero.note')}</p>
        </div>
        <div className={styles.visual} role="img" aria-label={t('hero.visual')}>
          <DeviceFrame kind="laptop" className={styles.laptop}>
            <ThemedImage media={shots.schedule} alt="" priority />
          </DeviceFrame>
          <DeviceFrame kind="phone" className={styles.phone}>
            <ThemedImage media={shots.miniapp} alt="" priority />
          </DeviceFrame>
        </div>
      </div>
    </section>
  );
}

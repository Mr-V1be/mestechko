import { brandName } from '@slotwise/i18n';
import { LanguageMenu } from '@slotwise/booking-ui';
import { Button, IconButton, Logo, LogoMark, useTheme } from '@slotwise/ui';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pageUrlOf } from '../../app/page-locale';
import styles from './chrome.module.css';

/** Section anchors of the page, in reading order. */
export const sectionIds = ['how', 'surfaces', 'verticals', 'pricing'] as const;

/** The bar over the page: the brand, the sections, the language, the theme and the demo. */
export function SiteHeader({ onDemo }: { readonly onDemo: () => void }) {
  const { t } = useTranslation();
  const { theme, setPreference } = useTheme();
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="#top" className={styles.brand} aria-label={brandName}>
          {/* A phone keeps the mark alone, so the language and the demo fit beside it. */}
          <span className={styles.wordmark}>
            <Logo name={brandName} />
          </span>
          <span className={styles.markOnly}>
            <LogoMark />
          </span>
        </a>
        <nav className={styles.nav} aria-label={t('nav.label')}>
          {sectionIds.map((id) => (
            <a key={id} href={`#${id}`} className={styles.navLink}>
              {t(`nav.${id}`)}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <LanguageMenu
            onChanged={(locale) => {
              // Each language has a page of its own, rendered ahead of time.
              window.location.assign(
                `${pageUrlOf(locale, import.meta.env.BASE_URL)}${window.location.hash}`,
              );
            }}
          />
          <IconButton
            label={t('nav.theme')}
            icon={
              <>
                <Moon className={styles.lightOnly} />
                <Sun className={styles.darkOnly} />
              </>
            }
            onClick={() => {
              setPreference(theme === 'dark' ? 'light' : 'dark');
            }}
          />
          <Button size="sm" onClick={onDemo}>
            {t('nav.demo')}
          </Button>
        </div>
      </div>
    </header>
  );
}

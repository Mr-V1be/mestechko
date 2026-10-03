import { Button, IconButton, Logo, useTheme } from '@mestechko/ui';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './chrome.module.css';

/** Section anchors of the page, in reading order. */
export const sectionIds = ['how', 'surfaces', 'verticals', 'pricing'] as const;

/** The bar over the page: the brand, the sections, the theme and the way into the demo. */
export function SiteHeader({ onDemo }: { readonly onDemo: () => void }) {
  const { t } = useTranslation();
  const { theme, setPreference } = useTheme();
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="#top" className={styles.brand}>
          <Logo name={t('common:brand.name')} />
        </a>
        <nav className={styles.nav} aria-label={t('nav.label')}>
          {sectionIds.map((id) => (
            <a key={id} href={`#${id}`} className={styles.navLink}>
              {t(`nav.${id}`)}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
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

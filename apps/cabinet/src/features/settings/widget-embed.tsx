import { Button, SegmentedControl, useToast } from '@mestechko/ui';
import { Code2, Copy, ExternalLink } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import styles from './settings.module.css';

const widgetModes = ['inline', 'popup'] as const;
const widgetThemes = ['auto', 'light', 'dark'] as const;
type WidgetMode = (typeof widgetModes)[number];
type WidgetTheme = (typeof widgetThemes)[number];

/** Demo businesses that have a sample website with the widget on it. */
const demoSites: Readonly<Record<string, string>> = { siren: '/demo/siren.html' };

/** The snippet a site owner pastes into their page. */
export function embedCode(slug: string, mode: WidgetMode, theme: WidgetTheme): string {
  const attributes = [
    `src="${appConfig.widgetBaseUrl}/widget.js"`,
    'data-mestechko',
    `data-business="${slug}"`,
    ...(mode === 'popup' ? ['data-mode="popup"'] : []),
    ...(theme === 'auto' ? [] : [`data-theme="${theme}"`]),
    'async',
  ];
  const script = `<script ${attributes.join(' ')}></script>`;
  return mode === 'inline' ? `<div data-mestechko-widget></div>\n${script}` : script;
}

/** The booking widget for the business's own website: how it looks and the code. */
export function WidgetEmbed({ slug }: { readonly slug: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const headingId = useId();
  const [mode, setMode] = useState<WidgetMode>('inline');
  const [theme, setTheme] = useState<WidgetTheme>('auto');
  const code = embedCode(slug, mode, theme);
  const demoSite = appConfig.demoMode ? demoSites[slug] : undefined;
  return (
    <section className={`${styles.section} ${styles.widgetSection}`} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        <Code2 aria-hidden="true" />
        {t('settings:sections.widget')}
      </h2>
      <div className={styles.sectionFields}>
        <p className={styles.widgetLead}>{t('settings:widget.lead')}</p>
        <div className={styles.widgetOptions}>
          <SegmentedControl
            label={t('settings:widget.mode')}
            value={mode}
            segments={widgetModes.map((value) => ({
              value,
              label: t(`settings:widget.modes.${value}`),
            }))}
            onChange={setMode}
          />
          <SegmentedControl
            label={t('settings:widget.theme')}
            value={theme}
            segments={widgetThemes.map((value) => ({
              value,
              label: t(`settings:widget.themes.${value}`),
            }))}
            onChange={setTheme}
          />
        </div>
        <pre className={styles.code} aria-label={t('settings:widget.code')}>
          <code>{code}</code>
        </pre>
        <p className={styles.ruleDefault}>
          {mode === 'inline' ? t('settings:widget.inlineHint') : t('settings:widget.popupHint')}
        </p>
        <div className={styles.widgetActions}>
          <Button
            icon={<Copy />}
            onClick={() => {
              navigator.clipboard.writeText(code).then(
                () => {
                  toast.show({ title: t('settings:widget.copied') });
                },
                () => {
                  toast.show({ title: t('settings:widget.copyFailed'), tone: 'error' });
                },
              );
            }}
          >
            {t('settings:widget.copy')}
          </Button>
          <Button
            variant="secondary"
            icon={<ExternalLink />}
            onClick={() => {
              const query = new URLSearchParams({ business: slug, theme });
              window.open(
                `${appConfig.widgetBaseUrl}/embed.html?${query.toString()}`,
                '_blank',
                'noopener',
              );
            }}
          >
            {t('settings:widget.preview')}
          </Button>
          {demoSite ? (
            <Button
              variant="ghost"
              icon={<ExternalLink />}
              onClick={() => {
                window.open(`${appConfig.widgetBaseUrl}${demoSite}`, '_blank', 'noopener');
              }}
            >
              {t('settings:widget.demoSite')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

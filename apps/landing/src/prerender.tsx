import type { Locale } from '@slotwise/domain';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './app/app';
import { siteConfig } from './app/config';
import { setUpI18n } from './app/i18n';
import { pagePaths } from './app/page-locale';

export interface RenderedPage {
  readonly locale: Locale;
  /** Where the page goes in the build, relative to its root: `index.html`, `en/index.html`. */
  readonly file: string;
  readonly markup: string;
  /** The page's own head: title, description and the links to its other languages. */
  readonly head: string;
}

const escape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const pageUrl = (locale: Locale): string =>
  new URL(pagePaths[locale], `${siteConfig.siteUrl.replace(/\/+$/, '')}/`).href;

/** A language's page as HTML for the build: visible before any script runs. */
async function renderPage(locale: Locale): Promise<RenderedPage> {
  const i18n = await setUpI18n(locale);
  const title = escape(i18n.t('meta.title'));
  const description = escape(i18n.t('meta.description'));
  const languages = Object.keys(pagePaths) as Locale[];
  const root = languages.find((language) => pagePaths[language] === '') ?? locale;
  const head = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="${locale}" />`,
    `<link rel="canonical" href="${pageUrl(locale)}" />`,
    ...languages.map(
      (language) => `<link rel="alternate" hreflang="${language}" href="${pageUrl(language)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(root)}" />`,
  ].join('\n    ');
  return {
    locale,
    file: `${pagePaths[locale]}index.html`,
    markup: renderToString(
      <StrictMode>
        <App i18n={i18n} />
      </StrictMode>,
    ),
    head,
  };
}

/** Every language's page of the site. */
export function render(): Promise<RenderedPage[]> {
  return Promise.all((Object.keys(pagePaths) as Locale[]).map(renderPage));
}

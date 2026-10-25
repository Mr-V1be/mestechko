import type { Locale } from '@mestechko/domain';

/**
 * Where each language's page of the site lives, under the site's base path. Every page
 * is rendered ahead of time in its language; the Russian one keeps the root address
 * the site always had.
 */
export const pagePaths: Readonly<Record<Locale, string>> = { en: 'en/', ru: '' };

const pageLocales = Object.keys(pagePaths) as Locale[];
const rootLocale = pageLocales.find((locale) => pagePaths[locale] === '');

/** The language of the page at `pathname`: the language whose path it is under, else the root's. */
export function pageLocaleOf(pathname: string, base: string): Locale {
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const locale =
    pageLocales.find(
      (candidate) => pagePaths[candidate] && path.startsWith(pagePaths[candidate]),
    ) ?? rootLocale;
  if (!locale) {
    throw new Error('One language must own the root page of the site');
  }
  return locale;
}

/** The address of a language's page. */
export function pageUrlOf(locale: Locale, base: string): string {
  return `${base}${pagePaths[locale]}`;
}

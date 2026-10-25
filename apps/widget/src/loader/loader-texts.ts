import { resolveLocale, type Locale } from '@mestechko/domain';
import { loader as en } from '../locales/en.json';
import { loader as ru } from '../locales/ru.json';

export type LoaderTexts = typeof en;

/** The embed script's own words: the button, the dialog and the frame's title. */
const loaderTexts: Readonly<Record<Locale, LoaderTexts>> = { en, ru };

/**
 * The embed script runs on the site's page and cannot see the choice a visitor made
 * inside the widget, so it starts in the browser's language; the widget then reports
 * the language it speaks (see `widget-messages`).
 */
export function initialLoaderLocale(): Locale {
  return resolveLocale(navigator.languages);
}

export function loaderTextsOf(locale: Locale): LoaderTexts {
  return loaderTexts[locale];
}

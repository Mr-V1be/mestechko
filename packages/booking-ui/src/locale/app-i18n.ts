import type { Locale } from '@mestechko/domain';
import { createI18n, type LocaleResources } from '@mestechko/i18n';
import type { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

/** Lazy locale files of an app, as `import.meta.glob(…, { import: 'default' })` returns them. */
export type LocaleFiles = Readonly<Record<string, () => Promise<unknown>>>;

const NESTED_FILE = /\/locales\/([\w-]+)\/([\w-]+)\.json$/;
const SINGLE_FILE = /\/locales\/([\w-]+)\.json$/;

/**
 * Loads one language of an app from its `locales` folder: `locales/<locale>/<name>.json`
 * files are namespaces named after them; an app with one namespace keeps
 * `locales/<locale>.json` and names it.
 */
export function localeLoader(
  files: LocaleFiles,
  singleNamespace?: string,
): (locale: Locale) => Promise<LocaleResources> {
  const entries = Object.entries(files).map(([path, read]) => {
    const nested = NESTED_FILE.exec(path);
    const single = SINGLE_FILE.exec(path);
    const locale = nested?.[1] ?? single?.[1];
    const namespace = nested?.[2] ?? (single ? singleNamespace : undefined);
    if (!locale || !namespace) {
      throw new Error(`Unexpected locale file ${path}`);
    }
    return { locale, namespace, read };
  });
  return async (locale) =>
    Object.fromEntries(
      await Promise.all(
        entries
          .filter((entry) => entry.locale === locale)
          .map(async (entry) => [entry.namespace, (await entry.read()) as object]),
      ),
    ) as LocaleResources;
}

/** The app's translations for React, starting in `locale`; others load on switching. */
export async function createAppI18n(options: {
  readonly locale: Locale;
  readonly defaultNamespace: string;
  readonly load: (locale: Locale) => Promise<LocaleResources>;
}): Promise<i18n> {
  const instance = await createI18n(options);
  instance.use(initReactI18next);
  initReactI18next.init(instance);
  return instance;
}

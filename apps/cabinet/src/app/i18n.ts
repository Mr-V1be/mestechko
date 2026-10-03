import { createI18n } from '@mestechko/i18n';
import type { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

/** Every file in `locales/ru` is a namespace named after it: `team.json` → `team:`. */
const namespaces = import.meta.glob<Record<string, unknown>>('../locales/ru/*.json', {
  eager: true,
  import: 'default',
});

function namespaceName(path: string): string {
  const name = /([\w-]+)\.json$/.exec(path)?.[1];
  if (!name) {
    throw new Error(`Unexpected locale file ${path}`);
  }
  return name;
}

export async function setUpI18n(): Promise<i18n> {
  const instance = await createI18n({
    defaultNamespace: 'cabinet',
    resources: {
      ru: Object.fromEntries(
        Object.entries(namespaces).map(([path, texts]) => [namespaceName(path), texts]),
      ),
    },
  });
  instance.use(initReactI18next);
  initReactI18next.init(instance);
  return instance;
}

import { createI18n } from '@mestechko/i18n';
import type { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import cabinet from '../locales/ru.json';

export async function setUpI18n(): Promise<i18n> {
  const instance = await createI18n({
    defaultNamespace: 'cabinet',
    resources: { ru: { cabinet } },
  });
  instance.use(initReactI18next);
  initReactI18next.init(instance);
  return instance;
}

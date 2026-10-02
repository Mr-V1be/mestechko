import { createI18n } from '@mestechko/i18n';
import type { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import miniapp from '../locales/ru.json';

export async function setUpI18n(): Promise<i18n> {
  const instance = await createI18n({
    defaultNamespace: 'miniapp',
    resources: { ru: { miniapp } },
  });
  instance.use(initReactI18next);
  initReactI18next.init(instance);
  return instance;
}

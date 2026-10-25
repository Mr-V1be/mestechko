import type { Locale } from '@mestechko/domain';
import { describe, expect, it } from 'vitest';
import { createI18n } from './create-i18n.js';

const cabinet = { ru: { title: 'Кабинет' }, en: { title: 'Dashboard' } } as const;
const load = (locale: Locale) => Promise.resolve({ cabinet: cabinet[locale] });

describe('application namespaces', () => {
  it('sit beside the shared ones', async () => {
    const i18n = await createI18n({ locale: 'ru', defaultNamespace: 'cabinet', load });
    expect(i18n.t('title')).toBe('Кабинет');
    expect(i18n.t('catalog:verticals.barbershop')).toBe('Барбершоп');
  });

  it('load another language when the app switches to it', async () => {
    const i18n = await createI18n({ locale: 'ru', defaultNamespace: 'cabinet', load });
    await i18n.changeLanguage('en');
    expect(i18n.t('title')).toBe('Dashboard');
    expect(i18n.t('catalog:verticals.barbershop')).toBe('Barbershop');
  });

  it('never replace a shared one', async () => {
    await expect(
      createI18n({
        locale: 'en',
        defaultNamespace: 'cabinet',
        load: () => Promise.resolve({ catalog: { title: 'Services' } }),
      }),
    ).rejects.toThrow(/catalog/);
  });
});

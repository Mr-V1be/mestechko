import { describe, expect, it } from 'vitest';
import { createI18n } from './create-i18n.js';

describe('application namespaces', () => {
  it('sit beside the shared ones', async () => {
    const i18n = await createI18n({
      defaultNamespace: 'cabinet',
      resources: { ru: { cabinet: { title: 'Кабинет' } } },
    });
    expect(i18n.t('title')).toBe('Кабинет');
    expect(i18n.t('catalog:verticals.barbershop')).toBe('Барбершоп');
  });

  it('never replace a shared one', async () => {
    await expect(
      createI18n({
        defaultNamespace: 'cabinet',
        resources: { ru: { catalog: { title: 'Услуги' } } },
      }),
    ).rejects.toThrow(/catalog/);
  });
});

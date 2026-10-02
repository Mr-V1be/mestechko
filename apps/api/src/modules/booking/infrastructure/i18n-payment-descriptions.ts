import { createI18n, formatInstant } from '@mestechko/i18n';
import payments from '../../../locales/ru/payments.json' with { type: 'json' };
import type { PaymentDescriptions } from '../application/ports.js';

/** Payment descriptions from the translation system. */
export async function loadPaymentDescriptions(): Promise<PaymentDescriptions> {
  const i18n = await createI18n({ defaultNamespace: 'payments', resources: { ru: { payments } } });
  return {
    describe: (input) =>
      i18n.t('description', {
        services: input.serviceNames.join(', '),
        business: input.businessName,
        when: formatInstant(i18n.language, input.startsAt.getTime(), input.timeZone, 'full'),
      }),
  };
}

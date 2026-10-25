import { formatInstant } from '@mestechko/i18n';
import type { Translations } from '../../../shared/application/translations.js';
import type { PaymentDescriptions } from '../application/ports.js';

/** Payment descriptions from the translation system, in the payer's language. */
export function paymentDescriptionsOf(translations: Translations): PaymentDescriptions {
  return {
    describe: (input) =>
      translations.in(input.locale, 'payments').text('description', {
        services: input.serviceNames.join(', '),
        business: input.businessName,
        when: formatInstant(input.locale, input.startsAt.getTime(), input.timeZone, 'full'),
      }),
  };
}

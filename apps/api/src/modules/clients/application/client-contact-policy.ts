import { isDemoPhone } from '@slotwise/contracts';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { ClientContact } from './ports.js';

/**
 * The contact a client gives when booking. Demo numbers (`+7 0XX …`) belong to the demo
 * only (a demo launch of the Mini App, a demo business's website); real bookings need
 * a real number.
 */
export function clientContactOf(
  contact: { readonly name: string; readonly phone: string },
  options: { readonly demoNumbersAllowed: boolean },
): ClientContact {
  if (isDemoPhone(contact.phone) && !options.demoNumbersAllowed) {
    throw new ApplicationError('validation_failed', 'A real phone number is required', {
      fields: { phone: 'invalid' },
    });
  }
  return { displayName: contact.name, phone: contact.phone };
}

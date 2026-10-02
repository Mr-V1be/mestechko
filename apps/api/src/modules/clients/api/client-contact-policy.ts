import { isDemoPhone } from '@mestechko/contracts';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { TelegramClientUser } from '../../../shared/application/messenger-user.js';
import type { ClientContact } from '../application/ports.js';

/**
 * The contact a client gives in the Mini App. Demo numbers (`+7 0XX …`) belong to demo
 * launches only; a real launch must give a real number.
 */
export function clientContactOf(
  contact: { readonly name: string; readonly phone: string },
  user: TelegramClientUser,
): ClientContact {
  if (isDemoPhone(contact.phone) && !user.demoLaunch) {
    throw new ApplicationError('validation_failed', 'A real phone number is required', {
      fields: { phone: 'invalid' },
    });
  }
  return { displayName: contact.name, phone: contact.phone };
}

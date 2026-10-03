import { normalizePhone, type BookingContact } from '@mestechko/contracts/client';
import type { TFunction } from 'i18next';
import { appConfig } from '../../app/config';

export interface ContactDraft {
  readonly name: string;
  readonly phone: string;
  readonly comment: string;
  readonly consent: boolean;
}

export interface ContactErrors {
  readonly name?: string;
  readonly phone?: string;
  readonly consent?: string;
}

export const emptyContact: ContactDraft = { name: '', phone: '', comment: '', consent: false };

/** The contact the API accepts, or what to say beside the fields. */
export function checkContact(
  t: TFunction,
  draft: ContactDraft,
  countryCode: string,
): { readonly contact: BookingContact | null; readonly errors: ContactErrors } {
  const phone = normalizePhone(draft.phone, countryCode, { allowDemo: appConfig.demoMode });
  const name = draft.name.trim();
  const errors: ContactErrors = {
    ...(name ? {} : { name: t('contact.nameRequired') }),
    ...(phone ? {} : { phone: t('contact.phoneInvalid') }),
    ...(draft.consent ? {} : { consent: t('contact.consentRequired') }),
  };
  return {
    contact: phone && name && draft.consent ? { name, phone } : null,
    errors,
  };
}

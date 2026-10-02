import { formatPhone } from '@mestechko/booking-ui';
import type { BookingContact } from '@mestechko/contracts/client';
import { TextField } from '@mestechko/ui';
import { retrieveLaunchParams } from '@tma.js/sdk-react';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../../platform/api/queries';
import { useContactDraft, type ContactDraft } from './contact-draft';
import { formatPhoneInput, normalizePhone } from './phone';

export interface ContactErrors {
  readonly name?: string;
  readonly phone?: string;
}

function telegramFirstName(): string {
  try {
    return retrieveLaunchParams().tgWebAppData?.user?.first_name ?? '';
  } catch {
    return '';
  }
}

/**
 * The client's contact draft for a business: what they typed survives, and an empty
 * draft starts from what the business already knows or the Telegram name.
 */
export function useClientContact(slug: string) {
  const profile = useProfile(slug);
  const [contact, setContact] = useContactDraft(`mst-contact:${slug}`, () => null);
  useEffect(() => {
    if (profile.data && !contact.name && !contact.phone) {
      setContact({
        name: profile.data.displayName ?? telegramFirstName(),
        phone: profile.data.phone ? formatPhone(profile.data.phone) : '',
        comment: contact.comment,
      });
    }
  }, [profile.data, contact, setContact]);
  return [contact, setContact] as const;
}

/** The contact the API accepts, or the messages to show beside the fields. */
export function checkContact(
  t: TFunction,
  contact: ContactDraft,
  countryCode: string,
): { readonly contact: BookingContact | null; readonly errors: ContactErrors } {
  const phone = normalizePhone(contact.phone, countryCode);
  const name = contact.name.trim();
  const errors: ContactErrors = {
    ...(name ? {} : { name: t('confirm.nameRequired') }),
    ...(phone ? {} : { phone: t('confirm.phoneInvalid') }),
  };
  return { contact: phone && name ? { name, phone } : null, errors };
}

export function ContactFields({
  contact,
  errors,
  countryCode,
  onChange,
}: {
  readonly contact: ContactDraft;
  readonly errors: ContactErrors;
  readonly countryCode: string;
  readonly onChange: (contact: ContactDraft) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        label={t('confirm.name')}
        autoComplete="given-name"
        value={contact.name}
        error={errors.name ?? null}
        onChange={(event) => {
          onChange({ ...contact, name: event.target.value });
        }}
      />
      <TextField
        label={t('confirm.phone')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t('confirm.phonePlaceholder')}
        description={t('confirm.phoneHint')}
        value={contact.phone}
        error={errors.phone ?? null}
        onChange={(event) => {
          onChange({ ...contact, phone: event.target.value });
        }}
        onBlur={() => {
          onChange({ ...contact, phone: formatPhoneInput(contact.phone, countryCode) });
        }}
      />
    </>
  );
}

import { formatPhone, phoneHint } from '@mestechko/booking-ui';
import { ApiError, normalizePhone } from '@mestechko/contracts/client';
import { useState } from 'react';
import { appConfig } from '../../../app/config';
import { fieldErrorsOf } from '../../common/error-message';
import type { ClientFields } from '../../../platform/api/clients-queries';

/** What the person types; phones are kept as typed until they leave the field. */
export interface ProfileDraft {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
}

export type ProfileField = keyof ProfileDraft;

/** Translation keys of the problems a field can have. */
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const emptyProfile: ProfileDraft = { name: '', phone: '', email: '' };

/** A plausible address: the API checks it fully. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function profileDraftOf(client: {
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
}): ProfileDraft {
  return {
    name: client.displayName,
    phone: client.phone ? formatPhone(client.phone) : '',
    email: client.email ?? '',
  };
}

function phoneOf(value: string, region: string): string | null {
  // Demo businesses take the demo range (`+7 0XX …`), since nobody there has a real number.
  return normalizePhone(value, region, { allowDemo: appConfig.demoMode });
}

function validate(draft: ProfileDraft, region: string): ProfileErrors {
  const phone = draft.phone.trim();
  const email = draft.email.trim();
  return {
    ...(draft.name.trim() ? {} : { name: 'clients:form.nameRequired' }),
    ...(phone && !phoneOf(phone, region) ? { phone: 'clients:form.phoneInvalid' } : {}),
    ...(email && !EMAIL_SHAPE.test(email) ? { email: 'clients:form.emailInvalid' } : {}),
  };
}

/**
 * State of the name, phone and e-mail fields: checked where they are typed, phones in
 * the business's region, and the API's verdicts (a phone of another card) shown at the
 * field they concern.
 */
export function useProfileForm(initial: ProfileDraft, region: string | undefined) {
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<ReadonlySet<ProfileField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  /** The API found the typed phone on another card; `owner` is that card when known. */
  const [takenPhone, setTakenPhone] = useState<{ readonly owner: string | null } | null>(null);

  const problems = region ? validate(draft, region) : {};
  const shown = (field: ProfileField) => submitted || touched.has(field);
  const errors: ProfileErrors = {
    ...(shown('name') && problems.name ? { name: problems.name } : {}),
    ...(shown('email') && problems.email ? { email: problems.email } : {}),
    ...(takenPhone
      ? { phone: 'clients:form.phoneTaken' }
      : shown('phone') && problems.phone
        ? { phone: problems.phone }
        : {}),
  };

  return {
    draft,
    errors,
    /** How phones of the business's region are prompted for; `null` while it loads. */
    phoneHint: region ? phoneHint(region) : null,
    /** Card that already has the typed phone, to offer opening it. */
    phoneOwner: takenPhone?.owner ?? null,
    /** The region is still loading: phones cannot be checked yet. */
    ready: region !== undefined,
    change(field: ProfileField, value: string) {
      setDraft((current) => ({ ...current, [field]: value }));
      if (field === 'phone') {
        setTakenPhone(null);
      }
    },
    /** A field is checked once the person leaves it; a valid phone takes its usual form. */
    leave(field: ProfileField) {
      setTouched((current) => new Set(current).add(field));
      const phone = region && field === 'phone' ? phoneOf(draft.phone.trim(), region) : null;
      if (phone) {
        setDraft((current) => ({ ...current, phone: formatPhone(phone) }));
      }
    },
    /** The fields for the API, or `null` with the problems shown at their fields. */
    submit(): Omit<ClientFields, 'tags'> | null {
      setSubmitted(true);
      if (!region || Object.keys(problems).length > 0 || takenPhone) {
        return null;
      }
      const phone = draft.phone.trim();
      const email = draft.email.trim();
      return {
        displayName: draft.name.trim(),
        phone: phone ? phoneOf(phone, region) : null,
        email: email || null,
      };
    },
    /** Shows the API's refusal at its field; `false` when it concerns no field. */
    reject(error: unknown): boolean {
      if (fieldErrorsOf(error).phone === 'taken' && error instanceof ApiError) {
        const details = error.details as { clientId?: unknown };
        setTakenPhone({ owner: typeof details.clientId === 'string' ? details.clientId : null });
        return true;
      }
      return false;
    },
    reset(next: ProfileDraft) {
      setDraft(next);
      setTouched(new Set());
      setSubmitted(false);
      setTakenPhone(null);
    },
  };
}

export type ProfileForm = ReturnType<typeof useProfileForm>;

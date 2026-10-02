import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { isDemoPhone } from './demo-phones.js';

/** Digits typed as `+7…` or `8…`, in E.164, when they form a demo number. */
export function asDemoPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const e164 = `+${digits.startsWith('8') ? `7${digits.slice(1)}` : digits}`;
  return isDemoPhone(e164) ? e164 : null;
}

/**
 * A phone as people type it (`8 916 123-45-67`, `+7 (916) …`) in E.164, or `null` when
 * it is not valid in its region. Demo numbers (`+7 0XX …`) count only where the demo
 * allows them, since nobody there has a real number to give.
 */
export function normalizePhone(
  value: string,
  country: string,
  options: { readonly allowDemo: boolean },
): string | null {
  const demo = asDemoPhone(value);
  if (demo) {
    return options.allowDemo ? demo : null;
  }
  const parsed = parsePhoneNumberFromString(value, country as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}

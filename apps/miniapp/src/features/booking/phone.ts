import { formatDemoPhone, isDemoPhone } from '@mestechko/contracts/client';
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/** Digits typed as `+7…` or `8…`, in E.164, when they form a demo number. */
function asDemoPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const e164 = `+${digits.startsWith('8') ? `7${digits.slice(1)}` : digits}`;
  return isDemoPhone(e164) ? e164 : null;
}

/** Formats digits as they are typed, e.g. `+7 916 123-45-67`. */
export function formatPhoneInput(value: string, country: string): string {
  const demo = asDemoPhone(value);
  return demo ? formatDemoPhone(demo) : new AsYouType(country as CountryCode).input(value);
}

/**
 * E.164 form for the API, or `null` when the number is not valid in its region. Demo
 * numbers (`+7 0XX …`) count only in the demo, where nobody has a real number to give.
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

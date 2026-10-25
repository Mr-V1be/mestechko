import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { asDemoPhone } from './demo-phones.js';

/**
 * A phone as people type it (`8 916 123-45-67`, `(212) 555-0123`, `+7 (916) …`) in E.164,
 * or `null` when it is not valid in its region. Demo numbers count only where the demo
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

interface PhoneHint {
  /** What an empty field shows: the shape of a number. */
  readonly placeholder: string;
  /** A real-looking number to point at when one is not recognized. */
  readonly example: string;
}

/** How phone fields of a business's country prompt for a number, in E.164. */
const phoneHints: Readonly<Record<string, PhoneHint>> = {
  RU: { placeholder: '+79000000000', example: '+79001234567' },
  BY: { placeholder: '+375290000000', example: '+375291234567' },
  KZ: { placeholder: '+77000000000', example: '+77011234567' },
  UZ: { placeholder: '+998900000000', example: '+998901234567' },
  US: { placeholder: '+12125550100', example: '+12125550123' },
};

/** The hint of a country's phone fields; `null` where the platform knows none. */
export function phoneHintOf(country: string): PhoneHint | null {
  return phoneHints[country] ?? null;
}

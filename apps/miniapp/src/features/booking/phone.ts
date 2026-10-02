import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/** Formats digits as they are typed, e.g. `+7 916 123-45-67`. */
export function formatPhoneInput(value: string, country: string): string {
  return new AsYouType(country as CountryCode).input(value);
}

/** E.164 form for the API, or `null` when the number is not valid in its region. */
export function normalizePhone(value: string, country: string): string | null {
  const parsed = parsePhoneNumberFromString(value, country as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}

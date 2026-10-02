import { asDemoPhone, formatDemoPhone } from '@mestechko/contracts/client';
import { AsYouType, type CountryCode } from 'libphonenumber-js/min';

/** Formats digits as they are typed, e.g. `+7 916 123-45-67`. */
export function formatPhoneInput(value: string, country: string): string {
  const demo = asDemoPhone(value);
  return demo ? formatDemoPhone(demo) : new AsYouType(country as CountryCode).input(value);
}

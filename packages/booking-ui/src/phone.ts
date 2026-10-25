import { asDemoPhone, formatDemoPhone, phoneHintOf } from '@mestechko/contracts/client';
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

const DIGITS = /\D/g;

/**
 * A stored E.164 number in the international form people read, keeping the dashes
 * the country uses at home: `+79161046686` → `+7 916 104-66-86`,
 * `+12125550123` → `+1 212 555-0123`.
 */
export function formatPhone(e164: string): string {
  // Some demo numbers are deliberately outside the numbering plan and carry their own spelling.
  const demo = formatDemoPhone(e164);
  if (demo) {
    return demo;
  }
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) {
    return e164;
  }
  const international = parsed.formatInternational();
  if (!parsed.isValid()) {
    return international;
  }
  // The national form carries the local habit of joining the tail with dashes
  // («104-66-86»); international formatting uses spaces only.
  const nationalTail = parsed.formatNational().split(' ').at(-1) ?? '';
  const joined = nationalTail.split('-');
  if (joined.length < 2) {
    return international;
  }
  const groups = international.split(' ');
  const tail = groups.slice(-joined.length);
  if (tail.join('').replace(DIGITS, '') !== nationalTail.replace(DIGITS, '')) {
    return international;
  }
  return [...groups.slice(0, -joined.length), tail.join('-')].join(' ');
}

/** How a phone field of the business's country prompts: its placeholder and an example. */
export function phoneHint(country: string): { placeholder: string; example: string } | null {
  const hint = phoneHintOf(country);
  return hint
    ? { placeholder: formatPhone(hint.placeholder), example: formatPhone(hint.example) }
    : null;
}

/** Formats digits as they are typed in the business's country: `+7 916 123-45-67`, `(212) 555-0123`. */
export function formatPhoneInput(value: string, country: string): string {
  const demo = asDemoPhone(value);
  return (
    (demo ? formatDemoPhone(demo) : null) ?? new AsYouType(country as CountryCode).input(value)
  );
}

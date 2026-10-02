/**
 * Phone numbers of the demo: Russian numbers whose area code starts with 0
 * (`+7 0XX XXX-XX-XX`). The Russian numbering plan assigns no codes starting with 0,
 * so such a number cannot belong to anyone. Real people's input is still checked
 * against the numbering plans; only demo launches may use these.
 */
export const DEMO_PHONE_PATTERN = /^\+70\d{9}$/;

export function isDemoPhone(e164: string): boolean {
  return DEMO_PHONE_PATTERN.test(e164);
}

/** `+70004123785` → `+7 000 412-37-85`, the way Russian numbers are written. */
export function formatDemoPhone(e164: string): string {
  const digits = e164.slice(2);
  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/** A demo number that stays the same for one demo visitor. */
export function demoPhoneFor(seed: string): string {
  let hash = 2_166_136_261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  const subscriber = String((hash >>> 0) % 1_000_000_000).padStart(9, '0');
  return `+70${subscriber}`;
}

/**
 * Phone numbers of the demo, per country: ranges no real subscriber can be reached at.
 * Real people's input is still checked against the numbering plans; only demo launches
 * may use these.
 */
export interface DemoPhoneRange {
  readonly pattern: RegExp;
  /** How numbers of the range read, for a hint: `+7 0XX XXX-XX-XX`. */
  readonly mask: string;
  /** A number of the range to show as an example. */
  readonly example: string;
  /** How many distinct numbers the range has. */
  readonly capacity: number;
  /** The range's number at `index` (0 ≤ index < capacity). */
  numberAt(index: number): string;
  /**
   * Spelling of a number the numbering plan refuses, so libphonenumber cannot group it;
   * absent when the plan's own grouping applies.
   */
  format?(e164: string): string;
  /** E.164 of digits as people type a number of the range the plan refuses (`8 000…`). */
  parse?(digits: string): string;
}

const RU_SUBSCRIBERS = 1_000_000_000;
/** Area codes of New York City; each holds the hundred numbers set aside for fiction. */
const NEW_YORK_AREA_CODES = ['212', '332', '347', '646', '718', '917', '929'] as const;
const US_FICTIONAL_LINES = 100;

export const demoPhoneRanges = {
  /**
   * Russia: area codes starting with 0 (`+7 0XX XXX-XX-XX`). The Russian numbering plan
   * assigns no codes starting with 0, so such a number cannot belong to anyone.
   */
  RU: {
    pattern: /^\+70\d{9}$/,
    mask: '+7 0XX XXX-XX-XX',
    example: '+70001234567',
    capacity: RU_SUBSCRIBERS,
    numberAt: (index) => `+70${String(index % RU_SUBSCRIBERS).padStart(9, '0')}`,
    format: (e164) => {
      const digits = e164.slice(2);
      return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
    },
    parse: (digits) => `+${digits.startsWith('8') ? `7${digits.slice(1)}` : digits}`,
  },
  /**
   * United States: `555-0100`–`555-0199` in any area code, reserved by the North American
   * Numbering Plan for fiction. The plan accepts them, so they group like any number.
   */
  US: {
    pattern: /^\+1[2-9]\d{2}55501\d{2}$/,
    mask: '+1 XXX 555-01XX',
    example: '+12125550123',
    capacity: NEW_YORK_AREA_CODES.length * US_FICTIONAL_LINES,
    numberAt: (index) => {
      const area = NEW_YORK_AREA_CODES[index % NEW_YORK_AREA_CODES.length] ?? '212';
      const line = Math.floor(index / NEW_YORK_AREA_CODES.length) % US_FICTIONAL_LINES;
      return `+1${area}55501${String(line).padStart(2, '0')}`;
    },
  },
} as const satisfies Record<string, DemoPhoneRange>;

export type DemoPhoneCountry = keyof typeof demoPhoneRanges;

const ranges: readonly DemoPhoneRange[] = Object.values(demoPhoneRanges);

/** The demo range of a country, if the demo has one there. */
export function demoPhoneRangeOf(country: string): DemoPhoneRange | null {
  return Object.hasOwn(demoPhoneRanges, country)
    ? demoPhoneRanges[country as DemoPhoneCountry]
    : null;
}

export function isDemoPhone(e164: string): boolean {
  return ranges.some((range) => range.pattern.test(e164));
}

/** The demo's own spelling of a number the numbering plan refuses; `null` otherwise. */
export function formatDemoPhone(e164: string): string | null {
  return ranges.find((range) => range.pattern.test(e164))?.format?.(e164) ?? null;
}

/** A demo number of the country that stays the same for one demo visitor. */
export function demoPhoneFor(seed: string, country: string): string | null {
  const range = demoPhoneRangeOf(country);
  if (!range) {
    return null;
  }
  let hash = 2_166_136_261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  return range.numberAt((hash >>> 0) % range.capacity);
}

/** Digits typed for a number the plan refuses (`8 000 …`), in E.164 when it is a demo one. */
export function asDemoPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  for (const range of ranges) {
    const e164 = range.parse?.(digits);
    if (e164 && range.pattern.test(e164)) {
      return e164;
    }
  }
  return null;
}

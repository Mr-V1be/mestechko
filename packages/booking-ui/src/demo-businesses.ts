import type { Locale } from '@slotwise/domain';

/**
 * The demo businesses shown to a reader: those of the reader's language, so the demo
 * looks native in it; every one when none speaks it.
 */
export function demoBusinessesIn<T extends { readonly locale: Locale }>(
  businesses: readonly T[],
  locale: Locale,
): readonly T[] {
  const own = businesses.filter((business) => business.locale === locale);
  return own.length > 0 ? own : businesses;
}

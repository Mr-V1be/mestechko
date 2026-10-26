import type { Money, ServiceAdmin } from '@slotwise/contracts/client';

/** The lowest and highest of what clients may see, when staff terms differ. */
export interface Span<T> {
  readonly min: T;
  readonly max: T;
}

/** Prices clients see across the people who provide the service. */
export function priceSpan(service: ServiceAdmin): Span<Money> {
  const amounts = service.staff.length
    ? service.staff.map((terms) => (terms.price ?? service.price).amountMinor)
    : [service.price.amountMinor];
  return {
    min: { ...service.price, amountMinor: Math.min(...amounts) },
    max: { ...service.price, amountMinor: Math.max(...amounts) },
  };
}

/** Durations across the people who provide the service. */
export function durationSpan(service: ServiceAdmin): Span<number> {
  const minutes = service.staff.length
    ? service.staff.map((terms) => terms.durationMinutes ?? service.durationMinutes)
    : [service.durationMinutes];
  return { min: Math.min(...minutes), max: Math.max(...minutes) };
}

export function varies<T extends number | Money>(span: Span<T>): boolean {
  const value = (item: T) => (typeof item === 'number' ? item : item.amountMinor);
  return value(span.min) !== value(span.max);
}

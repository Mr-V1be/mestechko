import type { Formatters } from '@slotwise/booking-ui';
import type { TFunction } from 'i18next';
import type { DraftPrice } from './booking-details';

/** "5 300 ₽", "4 700–5 300 ₽" or "от 4 700 ₽", depending on what is known. */
export function priceText(t: TFunction, format: Formatters, price: DraftPrice): string {
  const formats: {
    [K in DraftPrice['kind']]: (value: Extract<DraftPrice, { kind: K }>) => string;
  } = {
    exact: (value) => format.money(value.total),
    range: (value) => format.moneyRange(value.min, value.max),
    from: (value) => t('services.priceFrom', { price: format.money(value.min) }),
  };
  return (formats[price.kind] as (value: DraftPrice) => string)(price);
}

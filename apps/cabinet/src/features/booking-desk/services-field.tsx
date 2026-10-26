import type { ServiceCategory } from '@slotwise/contracts/client';
import { useFormat } from '@slotwise/booking-ui';
import { incompatibleWith } from '@slotwise/domain';
import { Checkbox, ListGroup, ListItem } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';

export interface ServicesFieldProps {
  readonly categories: readonly ServiceCategory[];
  readonly incompatible: readonly { readonly serviceId: string; readonly otherServiceId: string }[];
  readonly value: readonly string[];
  readonly onChange: (serviceIds: string[]) => void;
}

/** Services to book, by category; ones never booked with the chosen are unavailable. */
export function ServicesField({ categories, incompatible, value, onChange }: ServicesFieldProps) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const blocked = incompatibleWith(value, incompatible);
  return (
    <>
      {categories.map((category) => (
        <ListGroup key={category.id} title={category.name}>
          {category.services.map((service) => {
            const checked = value.includes(service.id);
            const disabled = !checked && blocked.has(service.id);
            const id = `desk-service-${service.id}`;
            return (
              <ListItem
                key={service.id}
                controlId={id}
                disabled={disabled}
                title={service.name}
                description={
                  disabled ? t('services.incompatible') : format.duration(service.durationMinutes)
                }
                meta={
                  service.priceVaries
                    ? t('services.priceFrom', { price: format.money(service.price) })
                    : format.money(service.price)
                }
                trailing={
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => {
                      if (disabled) {
                        return;
                      }
                      onChange(
                        next
                          ? [...value, service.id]
                          : value.filter((candidate) => candidate !== service.id),
                      );
                    }}
                  />
                }
              />
            );
          })}
        </ListGroup>
      ))}
    </>
  );
}

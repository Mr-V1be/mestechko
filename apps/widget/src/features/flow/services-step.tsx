import { useFormat } from '@slotwise/booking-ui';
import type { ServiceCategory } from '@slotwise/contracts/client';
import { incompatibleWith, type IncompatiblePair } from '@slotwise/domain';
import { Checkbox, EmptyIllustration, ListGroup, ListItem, StatePanel } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import styles from './widget.module.css';

export interface ServicesStepProps {
  readonly categories: readonly ServiceCategory[];
  readonly incompatible: readonly IncompatiblePair[];
  readonly limit: number;
  readonly chosen: readonly string[];
  readonly onChange: (serviceIds: readonly string[]) => void;
}

/** Services to book together: one person must do them all, and the business allows it. */
export function ServicesStep({
  categories,
  incompatible,
  limit,
  chosen,
  onChange,
}: ServicesStepProps) {
  const { t } = useTranslation();
  const format = useFormat();
  if (categories.length === 0) {
    return (
      <StatePanel
        compact
        illustration={<EmptyIllustration />}
        title={t('services.emptyTitle')}
        description={t('services.emptyDescription')}
      />
    );
  }
  const catalog = categories.flatMap((category) => category.services);
  const excluded = incompatibleWith(chosen, incompatible);
  const combinable = (providerIds: readonly string[]) =>
    catalog
      .filter((candidate) => chosen.includes(candidate.id))
      .reduce(
        (providers, selected) => providers.filter((id) => selected.providerIds.includes(id)),
        [...providerIds],
      ).length > 0;
  return (
    <>
      <p className={styles.hint}>{t('services.limit', { count: limit })}</p>
      {categories.map((category) => (
        <ListGroup key={category.id} title={category.name}>
          {category.services.map((service) => {
            const checked = chosen.includes(service.id);
            const notTogether = !checked && excluded.has(service.id);
            const apart = !checked && !notTogether && !combinable(service.providerIds);
            const disabled = !checked && (chosen.length >= limit || notTogether || apart);
            const controlId = `widget-service-${service.id}`;
            return (
              <ListItem
                key={service.id}
                controlId={controlId}
                selected={checked}
                disabled={disabled}
                title={service.name}
                description={
                  notTogether
                    ? t('services.notTogether')
                    : apart
                      ? t('services.incompatible')
                      : format.duration(service.durationMinutes)
                }
                meta={
                  service.priceVaries
                    ? t('services.priceFrom', { price: format.money(service.price) })
                    : format.money(service.price)
                }
                trailing={
                  <Checkbox
                    id={controlId}
                    checked={checked}
                    onCheckedChange={(next) => {
                      if (disabled && next) {
                        return;
                      }
                      onChange(
                        next
                          ? [...chosen, service.id]
                          : chosen.filter((serviceId) => serviceId !== service.id),
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

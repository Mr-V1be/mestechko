import { useFormat, useVocabulary } from '@mestechko/booking-ui';
import { Checkbox, EmptyIllustration, ListGroup, ListItem, StatePanel } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useServices } from '../../platform/api/queries';
import { haptics } from '../../platform/telegram/telegram-host';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { useCurrentBusiness } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, QueryErrorState } from '../layout/states';
import { BookingSummary, BookingSummaryBar } from './booking-summary';
import { useBookingSelection } from './selection';
import styles from './booking.module.css';

export function ServicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const vocabulary = useVocabulary(business.vertical);
  const { selection, pathTo, update } = useBookingSelection();
  const services = useServices(selection.slug, selection.locationId);
  const limit = business.booking.maxServicesPerBooking;
  const chosen = selection.serviceIds;

  useMainButton({
    text: vocabulary.staffNext,
    visible: chosen.length > 0,
    onClick: () => {
      void navigate(pathTo('staff', { staff: null, date: null, start: null }));
    },
  });

  const toggle = (serviceId: string, checked: boolean) => {
    haptics.selection();
    update({
      serviceIds: checked ? [...chosen, serviceId] : chosen.filter((id) => id !== serviceId),
      start: null,
    });
  };

  const categories = services.data?.categories ?? [];
  const catalog = categories.flatMap((category) => category.services);
  /** A service can join the selection only if one staff member provides all of them. */
  const combinable = (providerIds: readonly string[]) =>
    catalog
      .filter((candidate) => chosen.includes(candidate.id))
      .reduce(
        (providers, selected) => providers.filter((id) => selected.providerIds.includes(id)),
        [...providerIds],
      ).length > 0;
  return (
    <Page
      title={t('services.title')}
      lead={<span className={styles.limit}>{t('services.limit', { count: limit })}</span>}
      backTo={business.locations.length > 1 ? `/b/${encodeURIComponent(business.slug)}` : undefined}
      aside={<BookingSummary selection={selection} />}
      footer={<BookingSummaryBar selection={selection} />}
    >
      {services.isPending ? <ListSkeleton rows={6} /> : null}
      {services.isError ? (
        <QueryErrorState error={services.error} onRetry={() => void services.refetch()} />
      ) : null}
      {services.data && categories.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('services.emptyTitle')}
          description={t('services.emptyDescription')}
        />
      ) : null}
      {categories.map((category) => (
        <ListGroup key={category.id} title={category.name}>
          {category.services.map((service) => {
            const checked = chosen.includes(service.id);
            const incompatible = !checked && !combinable(service.providerIds);
            const disabled = !checked && (chosen.length >= limit || incompatible);
            const controlId = `service-${service.id}`;
            return (
              <ListItem
                key={service.id}
                controlId={controlId}
                selected={checked}
                disabled={disabled}
                title={service.name}
                description={incompatible ? t('services.incompatible') : service.description}
                meta={
                  <span className={styles.price}>
                    {service.priceVaries
                      ? t('services.priceFrom', { price: format.money(service.price) })
                      : format.money(service.price)}
                    <span className={styles.priceDuration}>
                      {format.duration(service.durationMinutes)}
                    </span>
                  </span>
                }
                trailing={
                  <Checkbox
                    id={controlId}
                    checked={checked}
                    onCheckedChange={(next) => {
                      if (!disabled || !next) {
                        toggle(service.id, next);
                      }
                    }}
                  />
                }
              />
            );
          })}
        </ListGroup>
      ))}
    </Page>
  );
}

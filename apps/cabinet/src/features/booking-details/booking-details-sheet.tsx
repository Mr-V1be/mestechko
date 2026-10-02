import { apiAssetUrl, BookingStatusBadge, formatPhone, useFormat } from '@mestechko/booking-ui';
import { Avatar, Button, ListGroup, ListItem, Sheet, Skeleton } from '@mestechko/ui';
import { CalendarClock, MapPin, MessageSquareText, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { useCabinetBooking } from '../../platform/api/queries';
import { QueryErrorState } from '../common/states';
import styles from './booking-details.module.css';

export interface BookingDetailsSheetProps {
  readonly businessId: string;
  readonly bookingId: string | null;
  readonly onClose: () => void;
}

/** Everything about one booking, beside the schedule or the list it was opened from. */
export function BookingDetailsSheet({ businessId, bookingId, onClose }: BookingDetailsSheetProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const booking = useCabinetBooking(businessId, bookingId);
  const data = booking.data;
  const time = (instant: string) => (data ? format.instant(instant, data.timeZone, 'time') : '');
  return (
    <Sheet
      open={bookingId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={data?.client.displayName ?? t('details.title')}
      description={data ? <BookingStatusBadge status={data.status} /> : undefined}
      closeLabel={t('common:actions.close')}
      footer={
        data?.client.phone ? (
          <Button
            variant="secondary"
            block
            icon={<Phone />}
            onClick={() => window.open(`tel:${data.client.phone ?? ''}`, '_self')}
          >
            {t('details.call')}
          </Button>
        ) : undefined
      }
    >
      {booking.isPending ? (
        <div className={styles.skeleton}>
          <Skeleton height="var(--size-control-lg)" />
          <Skeleton height="var(--size-control-lg)" />
          <Skeleton height="var(--size-control-lg)" />
        </div>
      ) : null}
      {booking.isError ? (
        <QueryErrorState error={booking.error} onRetry={() => void booking.refetch()} />
      ) : null}
      {data ? (
        <div className={styles.content}>
          <ListGroup>
            <ListItem
              leading={<CalendarClock aria-hidden="true" />}
              title={format.instant(data.start, data.timeZone, 'weekdayDayMonth')}
              description={`${time(data.start)}–${time(data.end)}`}
            />
            <ListItem
              leading={
                <Avatar
                  name={data.staff.displayName}
                  src={apiAssetUrl(appConfig.apiBaseUrl, data.staff.avatarUrl)}
                  size="sm"
                />
              }
              title={data.staff.displayName}
              description={data.staff.title ?? undefined}
            />
            <ListItem leading={<MapPin aria-hidden="true" />} title={data.location.name} />
            {data.client.phone ? (
              <ListItem
                leading={<Phone aria-hidden="true" />}
                title={formatPhone(data.client.phone)}
              />
            ) : null}
          </ListGroup>
          <ListGroup title={t('details.services')}>
            {data.items.map((item) => (
              <ListItem
                key={`${item.serviceId}-${item.start}`}
                title={item.serviceName}
                description={[`${time(item.start)}–${time(item.end)}`, item.resourceName]
                  .filter(Boolean)
                  .join(', ')}
                meta={format.money(item.price)}
              />
            ))}
            <ListItem title={t('details.total')} meta={format.money(data.total)} />
          </ListGroup>
          {data.comment ? (
            <ListGroup title={t('details.comment')}>
              <ListItem leading={<MessageSquareText aria-hidden="true" />} title={data.comment} />
            </ListGroup>
          ) : null}
          <p className={styles.meta}>
            {t('details.source')}: {t(`booking:source.${data.source}`)}.{' '}
            {t('details.created', { when: format.instant(data.createdAt, data.timeZone, 'full') })}
          </p>
        </div>
      ) : null}
    </Sheet>
  );
}

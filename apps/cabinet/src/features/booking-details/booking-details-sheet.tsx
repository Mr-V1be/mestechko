import { apiAssetUrl, BookingStatusBadge, formatPhone, useFormat } from '@mestechko/booking-ui';
import type { CabinetBookingDetails } from '@mestechko/contracts/client';
import { Avatar, Badge, Button, ListGroup, ListItem, Sheet, Skeleton } from '@mestechko/ui';
import { CalendarClock, MapPin, MessageSquareText, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { useCabinetBooking } from '../../platform/api/queries';
import { QueryErrorState } from '../common/states';
import { BookingActions } from './booking-actions';
import { BookingPayment } from './booking-payment';
import { BookingHistory } from './booking-history';
import styles from './booking-details.module.css';

export interface BookingDetailsSheetProps {
  readonly businessId: string;
  readonly bookingId: string | null;
  readonly onClose: () => void;
}

/**
 * The desk acts on a booking that can still change; a finished one only offers a call.
 */
function footerOf(businessId: string, booking: CabinetBookingDetails | undefined) {
  if (!booking) {
    return undefined;
  }
  if (Object.values(booking.actions).some(Boolean)) {
    return <BookingActions businessId={businessId} booking={booking} />;
  }
  return booking.client.phone ? <CallButton phone={booking.client.phone} /> : undefined;
}

function CallButton({ phone }: { readonly phone: string }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="secondary"
      block
      icon={<Phone />}
      onClick={() => window.open(`tel:${phone}`, '_self')}
    >
      {t('details.call')}
    </Button>
  );
}

/** Everything about one booking, beside the schedule or the list it was opened from. */
export function BookingDetailsSheet({ businessId, bookingId, onClose }: BookingDetailsSheetProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const booking = useCabinetBooking(businessId, bookingId);
  const data = booking.data;
  const timeRange = (start: string, end: string) =>
    data ? format.instantRange(start, end, data.timeZone, 'time') : '';
  return (
    <Sheet
      open={bookingId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={data?.client.displayName ?? t('details.title')}
      description={
        data ? (
          <span className={styles.badges}>
            <BookingStatusBadge status={data.status} />
            {data.attendanceConfirmedAt && data.status === 'confirmed' ? (
              <Badge tone="success">{t('details.attendanceConfirmed')}</Badge>
            ) : null}
          </span>
        ) : undefined
      }
      closeLabel={t('common:actions.close')}
      footer={footerOf(businessId, data)}
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
              description={timeRange(data.start, data.end)}
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
                description={[timeRange(item.start, item.end), item.resourceName]
                  .filter(Boolean)
                  .join(', ')}
                meta={format.money(item.price)}
              />
            ))}
            <ListItem title={t('details.total')} meta={format.money(data.total)} />
          </ListGroup>
          <BookingPayment booking={data} />
          <BookingHistory booking={data} />
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

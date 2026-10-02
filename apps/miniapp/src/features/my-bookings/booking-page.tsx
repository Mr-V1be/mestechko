import { apiAssetUrl, BookingStatusBadge, useFormat } from '@mestechko/booking-ui';
import { Avatar, CelebrationIllustration, ListGroup, ListItem } from '@mestechko/ui';
import { CalendarClock, MapPin, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { appConfig } from '../../app/config';
import { useClientBooking } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { isNotFound } from '../../shared/error-message';
import { useCurrentBusiness } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, NotFoundState, QueryErrorState } from '../layout/states';
import styles from './bookings.module.css';

/** One booking; right after booking it opens with a small celebration. */
export function BookingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const { bookingId = '' } = useParams();
  const [params] = useSearchParams();
  const created = params.get('created') === '1';
  const booking = useClientBooking(business.slug, bookingId);
  const listPath = `/b/${encodeURIComponent(business.slug)}/bookings`;

  useMainButton({
    text: t('booking.done'),
    visible: created,
    onClick: () => {
      void navigate(listPath, { replace: true });
    },
  });

  const data = booking.data;
  const timeZone = data?.location.timeZone ?? 'UTC';
  return (
    <Page title={created ? undefined : t('booking.title')} backTo={listPath}>
      {booking.isPending ? <ListSkeleton rows={4} /> : null}
      {booking.isError ? (
        isNotFound(booking.error) ? (
          <NotFoundState
            title={t('booking.notFoundTitle')}
            description={t('booking.notFoundDescription')}
          />
        ) : (
          <QueryErrorState error={booking.error} onRetry={() => void booking.refetch()} />
        )
      ) : null}
      {data ? (
        <>
          {created ? (
            <section className={styles.celebration} role="status">
              <div className={styles.celebrationArt}>
                <CelebrationIllustration />
              </div>
              <h1 className={styles.celebrationTitle}>{t('booking.createdTitle')}</h1>
              <p className={styles.celebrationLead}>
                {t('booking.createdLead', {
                  date: format.instant(data.start, timeZone, 'dayMonth'),
                  time: format.instant(data.start, timeZone, 'time'),
                })}
              </p>
            </section>
          ) : (
            <div className={styles.statusRow}>
              <BookingStatusBadge status={data.status} />
            </div>
          )}
          <ListGroup>
            <ListItem
              leading={<CalendarClock aria-hidden="true" />}
              title={format.instant(data.start, timeZone, 'weekdayDayMonth')}
              description={`${format.instant(data.start, timeZone, 'time')}–${format.instant(data.end, timeZone, 'time')}`}
            />
            <ListItem
              leading={
                <Avatar
                  name={data.staff.displayName}
                  src={apiAssetUrl(appConfig.apiBaseUrl, data.staff.avatarUrl)}
                />
              }
              title={data.staff.displayName}
              description={data.staff.title ?? undefined}
            />
            <ListItem
              leading={<MapPin aria-hidden="true" />}
              title={data.location.name}
              description={data.location.address}
            />
          </ListGroup>
          <ListGroup title={t('booking.services')}>
            {data.services.map((service) => (
              <ListItem
                key={service.id}
                title={service.name}
                description={format.duration(service.durationMinutes)}
                meta={format.money(service.price)}
              />
            ))}
            <ListItem title={t('booking.total')} meta={format.money(data.total)} />
          </ListGroup>
          {data.comment ? (
            <ListGroup title={t('booking.comment')}>
              <ListItem leading={<MessageSquareText aria-hidden="true" />} title={data.comment} />
            </ListGroup>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

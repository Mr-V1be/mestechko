import { apiAssetUrl, BookingStatusBadge, useFormat } from '@mestechko/booking-ui';
import { Avatar, CelebrationIllustration, ListGroup, ListItem, useToast } from '@mestechko/ui';
import { CalendarClock, MapPin, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { appConfig } from '../../app/config';
import { useConfirmAttendance } from '../../platform/api/lifecycle-queries';
import { useClientBooking } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage, isNotFound } from '../../shared/error-message';
import { useCurrentBusiness } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, NotFoundState, QueryErrorState } from '../layout/states';
import { NotificationsPrompt } from '../notifications/notifications-prompt';
import { BookingActions } from './booking-actions';
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
  const toast = useToast();
  const booking = useClientBooking(business.slug, bookingId);
  const confirmAttendance = useConfirmAttendance(business.slug);
  const listPath = `/b/${encodeURIComponent(business.slug)}/bookings`;
  const canConfirm = booking.data?.actions.confirm_attendance === true;

  // One primary action: finish after booking, otherwise confirm the visit while possible.
  useMainButton({
    text: created ? t('booking.done') : t('booking.confirmAttendance'),
    visible: created || canConfirm,
    loading: confirmAttendance.isPending,
    onClick: () => {
      if (created) {
        void navigate(listPath, { replace: true });
        return;
      }
      confirmAttendance.mutate(bookingId, {
        onSuccess: () => {
          haptics.success();
          toast.show({ title: t('booking.attendanceThanks') });
        },
        onError: (error) => {
          haptics.error();
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      });
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
          <BookingActions slug={business.slug} booking={data} />
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
          <NotificationsPrompt />
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

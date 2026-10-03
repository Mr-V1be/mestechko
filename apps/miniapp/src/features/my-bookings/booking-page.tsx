import { apiAssetUrl, BookingStatusBadge, useFormat } from '@mestechko/booking-ui';
import type { ClientBooking } from '@mestechko/contracts/client';
import {
  Avatar,
  Button,
  CelebrationIllustration,
  EmptyIllustration,
  ListGroup,
  ListItem,
  StatePanel,
  useToast,
} from '@mestechko/ui';
import { CalendarClock, MapPin, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { appConfig } from '../../app/config';
import { useConfirmAttendance } from '../../platform/api/lifecycle-queries';
import { PAYMENT_RETURN_PARAM } from '../../platform/api/payment-queries';
import { useClientBooking } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage, isNotFound } from '../../shared/error-message';
import { useCurrentBusiness } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, NotFoundState, QueryErrorState } from '../layout/states';
import { NotificationsPrompt } from '../notifications/notifications-prompt';
import { PaymentLine } from '../payment/payment-line';
import { PaymentPanel } from '../payment/payment-panel';
import {
  awaitsPayment,
  returnOutcome,
  RETURN_WAIT_MS,
  type ReturnOutcome,
} from '../payment/payment-state';
import { useCheckout } from '../payment/use-checkout';
import { BookingActions } from './booking-actions';
import styles from './bookings.module.css';

/** What opens the page: a fresh booking, a return from paying, or the booking itself. */
function Headline({
  booking,
  created,
  outcome,
  onBookAgain,
}: {
  readonly booking: ClientBooking;
  readonly created: boolean;
  readonly outcome: ReturnOutcome | null;
  readonly onBookAgain: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const timeZone = booking.location.timeZone;
  if (outcome === 'declined') {
    return (
      <StatePanel
        compact
        role="status"
        illustration={<EmptyIllustration />}
        title={t('payment.declinedTitle')}
        description={t('payment.declinedDescription')}
        action={
          <Button variant="secondary" onClick={onBookAgain}>
            {t('payment.bookAgain')}
          </Button>
        }
      />
    );
  }
  if (outcome === 'paid' || (created && !awaitsPayment(booking))) {
    return (
      <section className={styles.celebration} role="status">
        <div className={styles.celebrationArt}>
          <CelebrationIllustration />
        </div>
        <h1 className={styles.celebrationTitle}>
          {outcome === 'paid' ? t('payment.paidTitle') : t('booking.createdTitle')}
        </h1>
        <p className={styles.celebrationLead}>
          {t('booking.createdLead', {
            date: format.instant(booking.start, timeZone, 'dayMonth'),
            time: format.instant(booking.start, timeZone, 'time'),
          })}
        </p>
      </section>
    );
  }
  return (
    <div className={styles.statusRow}>
      <BookingStatusBadge status={booking.status} />
    </div>
  );
}

/** One booking; right after booking or paying it opens with a small celebration. */
export function BookingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const { bookingId = '' } = useParams();
  const [params] = useSearchParams();
  const created = params.get('created') === '1';
  const returned = params.get(PAYMENT_RETURN_PARAM) === 'return';
  const [returnedAt] = useState(() => Date.now());
  const toast = useToast();
  const booking = useClientBooking(
    business.slug,
    bookingId,
    returned
      ? {
          // The provider's notice may arrive a moment after the client is back.
          pollWhile: (current) =>
            awaitsPayment(current) && Date.now() - returnedAt < RETURN_WAIT_MS,
        }
      : {},
  );
  const confirmAttendance = useConfirmAttendance(business.slug);
  const checkout = useCheckout(business.slug);
  const listPath = `/b/${encodeURIComponent(business.slug)}/bookings`;
  const data = booking.data;
  const awaiting = data ? awaitsPayment(data) : false;
  const outcome = data && returned ? returnOutcome(data, booking.dataUpdatedAt - returnedAt) : null;
  const canConfirm = data?.actions.confirm_attendance === true;

  // One primary action: pay while the time is held, finish after booking, otherwise
  // confirm the visit while that is possible.
  useMainButton({
    text:
      awaiting && data?.deposit
        ? t('payment.pay', { amount: format.money(data.deposit) })
        : created || outcome === 'paid'
          ? t('booking.done')
          : t('booking.confirmAttendance'),
    visible: (awaiting && outcome !== 'checking') || created || outcome === 'paid' || canConfirm,
    loading: confirmAttendance.isPending || checkout.pending,
    onClick: () => {
      if (awaiting) {
        checkout.open(bookingId);
        return;
      }
      if (created || outcome === 'paid') {
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

  const timeZone = data?.location.timeZone ?? 'UTC';
  const celebrating = outcome === 'paid' || (created && !awaiting);
  return (
    <Page title={celebrating ? undefined : t('booking.title')} backTo={listPath}>
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
          <Headline
            booking={data}
            created={created}
            outcome={outcome}
            onBookAgain={() => {
              void navigate(`/b/${encodeURIComponent(business.slug)}`);
            }}
          />
          {awaiting ? <PaymentPanel slug={business.slug} booking={data} outcome={outcome} /> : null}
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
            <PaymentLine booking={data} />
          </ListGroup>
          {awaiting ? null : <NotificationsPrompt />}
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

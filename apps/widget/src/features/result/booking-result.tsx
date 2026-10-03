import { useFormat } from '@mestechko/booking-ui';
import type { WidgetBooking } from '@mestechko/contracts/client';
import {
  Button,
  CelebrationIllustration,
  EmptyIllustration,
  ListGroup,
  ListItem,
  Skeleton,
  Spinner,
  StatePanel,
} from '@mestechko/ui';
import { CalendarClock, Hourglass, MapPin, UserRound, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredBooking } from '../../embed/booking-tokens';
import { useWidgetBooking } from '../../platform/api/queries';
import styles from './result.module.css';

/** How long a returning payer waits for the confirmation before hearing it is late. */
const RETURN_WAIT_MS = 30_000;

function awaitsPayment(booking: WidgetBooking): boolean {
  return booking.status === 'held' && booking.hold?.reason === 'payment';
}

export interface BookingResultProps {
  readonly slug: string;
  readonly stored: StoredBooking | null;
  /** The visitor is back from the payment page. */
  readonly paymentReturn: boolean;
  readonly onAgain: () => void;
}

/** What the booking became: confirmed, waiting for its prepayment, or let go. */
export function BookingResult({ slug, stored, paymentReturn, onAgain }: BookingResultProps) {
  const { t } = useTranslation();
  const [returnedAt] = useState(() => Date.now());
  const booking = useWidgetBooking(
    slug,
    stored?.bookingId ?? '',
    stored?.token ?? null,
    (current) =>
      paymentReturn && awaitsPayment(current) && Date.now() - returnedAt < RETURN_WAIT_MS,
  );
  const again = (
    <Button variant="secondary" onClick={onAgain}>
      {t('result.again')}
    </Button>
  );
  if (!stored || booking.isError) {
    return (
      <StatePanel
        illustration={<EmptyIllustration />}
        title={t('result.lostTitle')}
        description={t('result.lostDescription')}
        action={again}
      />
    );
  }
  const data = booking.data;
  if (!data) {
    return (
      <div className={styles.skeleton} aria-busy="true">
        <Skeleton height="var(--size-illustration-sm)" />
        <Skeleton height="var(--size-control-lg)" />
        <Skeleton height="var(--size-control-lg)" />
      </div>
    );
  }
  if (data.status === 'cancelled') {
    const declined = data.paymentStatus === 'cancelled' && paymentReturn;
    return (
      <StatePanel
        illustration={<EmptyIllustration />}
        title={declined ? t('result.declinedTitle') : t('result.releasedTitle')}
        description={declined ? t('result.declinedDescription') : t('result.releasedDescription')}
        action={again}
      />
    );
  }
  return (
    <div className={styles.result}>
      {awaitsPayment(data) ? (
        <AwaitingPayment
          booking={data}
          checkoutUrl={stored.checkoutUrl}
          checking={paymentReturn && booking.dataUpdatedAt - returnedAt < RETURN_WAIT_MS}
        />
      ) : (
        <Celebration booking={data} paid={paymentReturn && data.paymentStatus === 'succeeded'} />
      )}
      <BookingSummary booking={data} />
      <div className={styles.actions}>{again}</div>
    </div>
  );
}

function Celebration({
  booking,
  paid,
}: {
  readonly booking: WidgetBooking;
  readonly paid: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const timeZone = booking.location.timeZone;
  return (
    <section className={styles.celebration} role="status">
      <div className={styles.art}>
        <CelebrationIllustration />
      </div>
      <h2 className={styles.title}>{paid ? t('result.paidTitle') : t('result.bookedTitle')}</h2>
      <p className={styles.lead}>
        {t('result.bookedLead', {
          date: format.instant(booking.start, timeZone, 'dayMonth'),
          time: format.instant(booking.start, timeZone, 'time'),
        })}
      </p>
    </section>
  );
}

function AwaitingPayment({
  booking,
  checkoutUrl,
  checking,
}: {
  readonly booking: WidgetBooking;
  readonly checkoutUrl: string | null;
  readonly checking: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const until = booking.hold
    ? format.instant(booking.hold.expiresAt, booking.location.timeZone, 'time')
    : '';
  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.panelHeading}>
        {checking ? <Spinner /> : <Hourglass aria-hidden="true" />}
        <h2 className={styles.panelTitle}>
          {checking ? t('result.checking') : t('result.awaitingTitle')}
        </h2>
      </div>
      <p className={styles.panelText}>
        {booking.deposit
          ? t('result.awaiting', { time: until, amount: format.money(booking.deposit) })
          : t('result.late')}
      </p>
      {checkoutUrl && booking.deposit && !checking ? (
        <Button
          onClick={() => {
            window.location.assign(checkoutUrl);
          }}
        >
          {t('result.pay', { amount: format.money(booking.deposit) })}
        </Button>
      ) : null}
    </section>
  );
}

function BookingSummary({ booking }: { readonly booking: WidgetBooking }) {
  const { t } = useTranslation();
  const format = useFormat();
  const timeZone = booking.location.timeZone;
  const paymentState =
    booking.paymentStatus === 'succeeded'
      ? t('result.depositPaid')
      : booking.paymentStatus === 'refunded'
        ? t('result.depositRefunded')
        : t('result.depositPending');
  return (
    <ListGroup>
      <ListItem
        leading={<CalendarClock aria-hidden="true" />}
        title={format.instant(booking.start, timeZone, 'weekdayDayMonth')}
        description={`${format.instant(booking.start, timeZone, 'time')}–${format.instant(booking.end, timeZone, 'time')}`}
      />
      <ListItem
        leading={<UserRound aria-hidden="true" />}
        title={booking.staffName}
        description={booking.serviceNames.join(', ')}
        meta={format.money(booking.total)}
      />
      <ListItem
        leading={<MapPin aria-hidden="true" />}
        title={booking.location.name}
        description={booking.location.address}
      />
      {booking.deposit ? (
        <ListItem
          leading={<Wallet aria-hidden="true" />}
          title={t('result.deposit')}
          description={paymentState}
          meta={format.money(booking.deposit)}
        />
      ) : null}
    </ListGroup>
  );
}

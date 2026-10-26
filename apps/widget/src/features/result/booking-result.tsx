import { useFormat } from '@slotwise/booking-ui';
import type { WidgetBooking } from '@slotwise/contracts/client';
import {
  Button,
  Callout,
  CelebrationIllustration,
  EmptyIllustration,
  ListGroup,
  ListItem,
  Skeleton,
  Spinner,
  StatePanel,
} from '@slotwise/ui';
import { CalendarClock, Hourglass, MapPin, UserRound, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredBooking } from '../../embed/booking-tokens';
import { openCheckout } from '../../embed/checkout-openers';
import { useWidgetBooking } from '../../platform/api/queries';
import styles from './result.module.css';

/** How long a returning payer waits for the confirmation before hearing it is late. */
const RETURN_WAIT_MS = 30_000;

function awaitsPayment(booking: WidgetBooking): boolean {
  return booking.status === 'held' && booking.hold?.reason === 'payment';
}

/** Back from the payment page in place of the form, or paying in a new window. */
export type PaymentStage = 'returned' | 'outside';

export interface BookingResultProps {
  readonly slug: string;
  readonly stored: StoredBooking | null;
  /** `null` when no payment page was opened in this visit. */
  readonly stage: PaymentStage | null;
  readonly onAgain: () => void;
}

/** What the booking became: confirmed, waiting for its prepayment, or let go. */
export function BookingResult({ slug, stored, stage, onAgain }: BookingResultProps) {
  const { t } = useTranslation();
  const [returnedAt] = useState(() => Date.now());
  // Paying in a new window takes as long as it takes; a return settles in seconds.
  const booking = useWidgetBooking(
    slug,
    stored?.bookingId ?? '',
    stored?.token ?? null,
    (current) =>
      awaitsPayment(current) &&
      (stage === 'outside' || (stage === 'returned' && Date.now() - returnedAt < RETURN_WAIT_MS)),
  );
  const paymentReturn = stage !== null;
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
          stored={stored}
          outside={stage === 'outside'}
          checking={stage === 'returned' && booking.dataUpdatedAt - returnedAt < RETURN_WAIT_MS}
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
  stored,
  outside,
  checking,
}: {
  readonly booking: WidgetBooking;
  readonly stored: StoredBooking;
  /** The page is open in another window; the form waits for the payment. */
  readonly outside: boolean;
  readonly checking: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const until = booking.hold
    ? format.instant(booking.hold.expiresAt, booking.location.timeZone, 'time')
    : '';
  const { checkoutUrl, checkoutPresentation } = stored;
  return (
    <Callout
      icon={checking || outside ? <Spinner /> : <Hourglass />}
      title={checking ? t('result.checking') : t('result.awaitingTitle')}
      actions={
        checkoutUrl && checkoutPresentation && booking.deposit && !checking ? (
          <Button
            onClick={() => {
              openCheckout(checkoutUrl, checkoutPresentation);
            }}
          >
            {outside
              ? t('result.reopen')
              : t('result.pay', { amount: format.money(booking.deposit) })}
          </Button>
        ) : undefined
      }
    >
      {outside
        ? t('result.outside', { time: until })
        : booking.deposit
          ? t('result.awaiting', { time: until, amount: format.money(booking.deposit) })
          : t('result.late')}
    </Callout>
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
        description={format.instantRange(booking.start, booking.end, timeZone, 'time')}
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

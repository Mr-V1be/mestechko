import { useFormat } from '@mestechko/booking-ui';
import type { ClientBooking } from '@mestechko/contracts/client';
import { Button, Spinner, useToast } from '@mestechko/ui';
import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCancelBooking } from '../../platform/api/lifecycle-queries';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage } from '../../shared/error-message';
import type { ReturnOutcome } from './payment-state';
import styles from './payment.module.css';

export interface PaymentPanelProps {
  readonly slug: string;
  readonly booking: ClientBooking;
  /** Set when the client came back from the payment page. */
  readonly outcome: ReturnOutcome | null;
}

/**
 * A booking that holds its time until the prepayment arrives: until when, how much and
 * what is left to pay at the visit. Paying is the screen's main button; letting the
 * time go is a quiet secondary step.
 */
export function PaymentPanel({ slug, booking, outcome }: PaymentPanelProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const release = useCancelBooking(slug);
  if (!booking.hold || !booking.deposit) {
    return null;
  }
  const until = format.instant(booking.hold.expiresAt, booking.location.timeZone, 'time');
  const rest = {
    amountMinor: Math.max(0, booking.total.amountMinor - booking.deposit.amountMinor),
    currency: booking.total.currency,
  };
  const checking = outcome === 'checking';
  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.heading}>
        {checking ? <Spinner /> : <Hourglass aria-hidden="true" />}
        <h2 className={styles.title}>
          {checking ? t('payment.checking') : t('payment.awaitingTitle')}
        </h2>
      </div>
      <p className={styles.text}>
        {outcome === 'late'
          ? t('payment.late', { time: until })
          : t('payment.awaiting', {
              time: until,
              amount: format.money(booking.deposit),
              rest: format.money(rest),
            })}
      </p>
      {booking.actions.cancel ? (
        <Button
          variant="ghost"
          size="sm"
          loading={release.isPending}
          onClick={() => {
            release.mutate(booking.id, {
              onSuccess: () => {
                haptics.success();
                toast.show({ title: t('payment.released') });
              },
              onError: (error) => {
                haptics.error();
                toast.show({ title: errorMessage(t, error), tone: 'error' });
              },
            });
          }}
        >
          {t('payment.release')}
        </Button>
      ) : null}
    </section>
  );
}

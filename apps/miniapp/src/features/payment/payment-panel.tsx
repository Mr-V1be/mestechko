import { errorMessage, useFormat } from '@slotwise/booking-ui';
import type { ClientBooking } from '@slotwise/contracts/client';
import { Button, Callout, Spinner, useToast } from '@slotwise/ui';
import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCancelBooking } from '../../platform/api/lifecycle-queries';
import { haptics } from '../../platform/telegram/telegram-host';
import type { ReturnOutcome } from './payment-state';

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
  // Back from the page, or paying in the browser: either way the answer is on its way.
  const checking = outcome === 'checking' || outcome === 'outside';
  return (
    <Callout
      icon={checking ? <Spinner /> : <Hourglass />}
      title={
        outcome === 'outside'
          ? t('payment.outsideTitle')
          : checking
            ? t('payment.checking')
            : t('payment.awaitingTitle')
      }
      actions={
        booking.actions.cancel ? (
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
        ) : undefined
      }
    >
      {outcome === 'late'
        ? t('payment.late', { time: until })
        : outcome === 'outside'
          ? t('payment.outside', { time: until })
          : t('payment.awaiting', {
              time: until,
              amount: format.money(booking.deposit),
              rest: format.money(rest),
            })}
    </Callout>
  );
}

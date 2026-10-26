import { useFormat } from '@slotwise/booking-ui';
import type { ClientBooking } from '@slotwise/contracts/client';
import { ListItem } from '@slotwise/ui';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The prepayment of a booking and where it stands. */
export function PaymentLine({ booking }: { readonly booking: ClientBooking }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (!booking.deposit) {
    return null;
  }
  const payment = booking.payment;
  const state = payment
    ? payment.refunded.amountMinor > 0
      ? t('payment.line.refundedAmount', { amount: format.money(payment.refunded) })
      : t(`payment.line.${payment.status}`)
    : t('payment.line.pending');
  return (
    <ListItem
      leading={<Wallet aria-hidden="true" />}
      title={t('payment.line.title')}
      description={state}
      meta={format.money(booking.deposit)}
    />
  );
}

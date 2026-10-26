import { useFormat } from '@slotwise/booking-ui';
import type { CabinetBookingDetails } from '@slotwise/contracts/client';
import { Badge, ListGroup, ListItem, type BadgeTone } from '@slotwise/ui';
import { BellRing, Hourglass, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const paymentTones: Record<NonNullable<CabinetBookingDetails['payment']>['status'], BadgeTone> = {
  pending: 'outline',
  succeeded: 'success',
  cancelled: 'neutral',
  refunded: 'neutral',
};

/** Ledger lines counted in points rather than money. */
const pointReasons = new Set(['points_accrual', 'points_redemption', 'points_adjustment']);
/** Ledger lines counted in pass visits. */
const visitReasons = new Set(['pass_visit', 'pass_adjustment']);

/** Money around a booking: the prepayment it waits for or got, and how the visit was paid. */
export function BookingPayment({ booking }: { readonly booking: CabinetBookingDetails }) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const { hold, deposit, payment, settlement, notifiedVia } = booking;
  if (!hold && !deposit && !payment && !settlement && !notifiedVia) {
    return null;
  }
  const amountOf = (reason: string, amount: number, passName: string | null) => {
    if (pointReasons.has(reason)) {
      return t('points', { count: amount, points: format.number(amount) });
    }
    if (visitReasons.has(reason)) {
      return passName
        ? `${t('visits', { count: amount })} · ${passName}`
        : t('visits', { count: amount });
    }
    return format.money({ amountMinor: amount, currency: booking.total.currency });
  };
  return (
    <>
      {hold || deposit || payment || notifiedVia ? (
        <ListGroup>
          {hold ? (
            <ListItem
              leading={<Hourglass aria-hidden="true" />}
              title={t(`details.hold.${hold.reason}`, {
                time: format.instant(hold.expiresAt, booking.timeZone, 'time'),
              })}
            />
          ) : null}
          {deposit ? (
            <ListItem
              leading={<Wallet aria-hidden="true" />}
              title={t('details.deposit')}
              description={
                payment && payment.refunded.amountMinor > 0
                  ? t('details.refunded', { amount: format.money(payment.refunded) })
                  : undefined
              }
              meta={format.money(deposit)}
              trailing={
                payment ? (
                  <Badge tone={paymentTones[payment.status]}>
                    {t(`details.payment.${payment.status}`)}
                  </Badge>
                ) : undefined
              }
            />
          ) : null}
          {notifiedVia ? (
            <ListItem
              leading={<BellRing aria-hidden="true" />}
              title={t('details.notifiedVia', { channel: t(`channels.${notifiedVia}`) })}
            />
          ) : null}
        </ListGroup>
      ) : null}
      {settlement && settlement.entries.length > 0 ? (
        <ListGroup title={t('details.settlement')}>
          {settlement.entries.map((entry, index) => (
            <ListItem
              // An ordered ledger excerpt in which a reason may repeat.
              key={`${entry.reason}-${String(index)}`}
              title={t(`ledger.${entry.reason}`)}
              meta={amountOf(entry.reason, Math.abs(entry.amount), entry.passName)}
            />
          ))}
        </ListGroup>
      ) : null}
    </>
  );
}

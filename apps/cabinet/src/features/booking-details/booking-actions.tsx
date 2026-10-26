import { useFormat } from '@slotwise/booking-ui';
import type { CabinetBookingDetails } from '@slotwise/contracts/client';
import { Button, ConfirmDialog, Menu, useToast, type MenuAction } from '@slotwise/ui';
import { CalendarClock, CircleCheck, Phone, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingAction } from '../../platform/api/desk-queries';
import { useOverview } from '../../platform/api/queries';
import { CompleteVisitDialog } from '../booking-desk/complete-visit-dialog';
import { MoveBookingDialog } from '../booking-desk/move-booking-dialog';
import { errorMessage } from '../common/error-message';
import styles from './booking-details.module.css';

type OpenDialog = 'move' | 'cancel' | 'no_show' | 'complete' | null;

export interface BookingActionsProps {
  readonly businessId: string;
  readonly booking: CabinetBookingDetails;
}

/** Money a cancellation returns: what was paid and not yet given back. */
function refundableMinor(booking: CabinetBookingDetails): number {
  const payment = booking.payment;
  return payment?.status === 'succeeded'
    ? payment.amount.amountMinor - payment.refunded.amountMinor
    : 0;
}

/**
 * What the desk does with a booking: the likely next step as a button, the rest
 * behind «⋯». Each consequential step names what it will cause before it happens.
 */
export function BookingActions({ businessId, booking }: BookingActionsProps) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const toast = useToast();
  const overview = useOverview(businessId);
  const cancel = useBookingAction(businessId, 'cancel');
  const noShow = useBookingAction(businessId, 'noShow');
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const money = (amountMinor: number) =>
    format.money({ amountMinor, currency: booking.total.currency });
  const close = (open: boolean) => {
    if (!open) {
      setDialog(null);
    }
  };
  const run = (mutation: typeof cancel, done: string) => {
    mutation.mutate(booking, {
      onSuccess: () => {
        setDialog(null);
        toast.show({ title: done });
      },
      onError: (error) => {
        setDialog(null);
        toast.show({ title: errorMessage(t, error), tone: 'error' });
      },
    });
  };
  const phone = booking.client.phone;
  const menu: MenuAction[] = [
    ...(booking.actions.no_show
      ? [
          {
            key: 'no_show',
            label: t('noShow.action'),
            icon: <UserX aria-hidden="true" />,
            onSelect: () => {
              setDialog('no_show');
            },
          },
        ]
      : []),
    ...(phone
      ? [
          {
            key: 'call',
            label: t('cabinet:details.call'),
            icon: <Phone aria-hidden="true" />,
            onSelect: () => {
              window.open(`tel:${phone}`, '_self');
            },
          },
        ]
      : []),
    ...(booking.actions.cancel
      ? [
          {
            key: 'cancel',
            label: t('cancel.action'),
            icon: <X aria-hidden="true" />,
            tone: 'danger' as const,
            onSelect: () => {
              setDialog('cancel');
            },
          },
        ]
      : []),
  ];
  const refund = refundableMinor(booking);
  const notify = booking.notifiedVia
    ? t('cancel.notify', { channel: t(`channels.${booking.notifiedVia}`) })
    : null;

  return (
    <div className={styles.actions}>
      {booking.actions.complete ? (
        <Button
          icon={<CircleCheck />}
          onClick={() => {
            setDialog('complete');
          }}
        >
          {t('complete.action')}
        </Button>
      ) : null}
      {booking.actions.move && overview.data ? (
        <Button
          variant={booking.actions.complete ? 'secondary' : 'primary'}
          icon={<CalendarClock />}
          onClick={() => {
            setDialog('move');
          }}
        >
          {t('details.move')}
        </Button>
      ) : null}
      {menu.length > 0 ? <Menu label={t('details.actions')} actions={menu} /> : null}

      {overview.data ? (
        <MoveBookingDialog
          businessId={businessId}
          slug={overview.data.business.slug}
          staff={overview.data.staff}
          booking={booking}
          open={dialog === 'move'}
          onOpenChange={close}
        />
      ) : null}
      <CompleteVisitDialog
        businessId={businessId}
        booking={booking}
        open={dialog === 'complete'}
        onOpenChange={close}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={close}
        title={t('cancel.title')}
        consequence={t('cancel.consequence')}
        confirmLabel={t('cancel.confirm')}
        cancelLabel={t('cancel.keep')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        pending={cancel.isPending}
        onConfirm={() => {
          run(cancel, t('cancel.done'));
        }}
      >
        <ul className={styles.consequences}>
          {refund > 0 ? <li>{t('cancel.refund', { amount: money(refund) })}</li> : null}
          {booking.hold?.reason === 'payment' ? <li>{t('cancel.releaseHold')}</li> : null}
          {notify ? <li>{notify}</li> : null}
        </ul>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'no_show'}
        onOpenChange={close}
        title={t('noShow.title')}
        consequence={t('noShow.consequence')}
        confirmLabel={t('noShow.confirm')}
        cancelLabel={t('common:actions.cancel')}
        closeLabel={t('common:actions.close')}
        pending={noShow.isPending}
        onConfirm={() => {
          run(noShow, t('noShow.done'));
        }}
      >
        {refund > 0 ? (
          <ul className={styles.consequences}>
            <li>{t('noShow.depositKept', { amount: money(refund) })}</li>
          </ul>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

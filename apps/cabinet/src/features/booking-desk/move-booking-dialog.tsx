import { useFormat } from '@mestechko/booking-ui';
import {
  ApiError,
  type CabinetBookingDetails,
  type CabinetStaff,
} from '@mestechko/contracts/client';
import { Button, Dialog, useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookableServices } from '../../platform/api/desk-queries';
import {
  instantAt,
  localDateOf,
  minuteOn,
  parseWallTime,
  wallTime,
} from '../schedule/timeline-model';
import { useMoveWithUndo } from './use-move-with-undo';
import { WhenFields, type WhenValue } from './when-fields';
import styles from './desk.module.css';

export interface MoveBookingDialogProps {
  readonly businessId: string;
  readonly slug: string;
  readonly staff: readonly CabinetStaff[];
  readonly booking: CabinetBookingDetails;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Moving a booking by form: the keyboard and touch way to what dragging does. */
export function MoveBookingDialog(props: MoveBookingDialogProps) {
  const { t } = useTranslation('desk');
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('move.title')}
      description={props.booking.client.displayName}
      closeLabel={t('common:actions.close')}
    >
      {props.open ? <MoveForm key={props.booking.version} {...props} /> : null}
    </Dialog>
  );
}

function MoveForm({ businessId, slug, staff, booking, onOpenChange }: MoveBookingDialogProps) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const toast = useToast();
  const timeZone = booking.timeZone;
  const date = localDateOf(booking.start, timeZone);
  const [when, setWhen] = useState<WhenValue>({
    staffId: booking.staff.id,
    date,
    time: wallTime(minuteOn(date, booking.start, timeZone)),
  });
  const [timeError, setTimeError] = useState<string | null>(null);
  const services = useBookableServices(slug, booking.location.id);
  const serviceIds = booking.items.map((item) => item.serviceId);
  const offered = (services.data?.categories ?? []).flatMap((category) => category.services);
  const provides = (memberId: string, serviceId: string) =>
    offered.find((service) => service.id === serviceId)?.providerIds.includes(memberId) ?? false;
  // Until the catalog loads, the current staff member is the one known choice.
  const providers = services.data
    ? staff.filter((member) => serviceIds.every((serviceId) => provides(member.id, serviceId)))
    : staff.filter((member) => member.id === booking.staff.id);
  const { move, pending } = useMoveWithUndo(businessId);

  const submit = () => {
    const minute = parseWallTime(when.time);
    if (minute === null) {
      setTimeError(t('when.timeRequired'));
      return;
    }
    move(
      {
        bookingId: booking.id,
        staffId: when.staffId,
        start: instantAt(when.date, minute, timeZone),
        expectedVersion: booking.version,
        previous: { staffId: booking.staff.id, start: booking.start },
        staffName: (id) => staff.find((member) => member.id === id)?.displayName ?? '',
        timeZone,
      },
      {
        onDone: () => {
          onOpenChange(false);
        },
        onRefused: (message, error) => {
          if (error instanceof ApiError && error.code === 'slot_unavailable') {
            setTimeError(message);
          } else {
            toast.show({ title: message, tone: 'error' });
          }
        },
      },
    );
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <WhenFields
        slug={slug}
        locationId={booking.location.id}
        timeZone={timeZone}
        serviceIds={serviceIds}
        staff={providers}
        value={when}
        onChange={(value) => {
          setWhen(value);
          setTimeError(null);
        }}
        timeError={timeError}
      />
      <p className={styles.hint}>{t('move.priceKept', { total: format.money(booking.total) })}</p>
      <Button type="submit" block loading={pending}>
        {t('move.submit')}
      </Button>
    </form>
  );
}

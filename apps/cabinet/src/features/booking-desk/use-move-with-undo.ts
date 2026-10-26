import { useFormat } from '@slotwise/booking-ui';
import type { CabinetBookingDetails } from '@slotwise/contracts/client';
import { useToast } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { useMoveBooking, type MoveInput } from '../../platform/api/desk-queries';
import { errorMessage } from '../common/error-message';

export interface MoveRequest extends MoveInput {
  /** Where it was, to put it back from the toast. */
  readonly previous: { readonly staffId: string; readonly start: string };
  readonly staffName: (staffId: string) => string;
  readonly timeZone: string;
}

/**
 * Moves a booking at once on screen and confirms it with a toast that can put it
 * back. A refusal rolls the screen back and is reported where the caller wants it.
 */
export function useMoveWithUndo(businessId: string) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const toast = useToast();
  const mutation = useMoveBooking(businessId);

  const move = (
    request: MoveRequest,
    handlers: {
      readonly onDone?: () => void;
      readonly onRefused: (message: string, error: unknown) => void;
    },
  ) => {
    const { previous, staffName, timeZone, ...input } = request;
    const describe = (details: CabinetBookingDetails) =>
      t('move.doneDescription', {
        when: `${format.instant(details.start, timeZone, 'weekdayDayMonth')}, ${format.instant(details.start, timeZone, 'time')}`,
        staff: staffName(details.staff.id),
      });
    mutation.mutate(input, {
      onSuccess: (details) => {
        handlers.onDone?.();
        toast.show({
          title: t('move.done'),
          description: [
            describe(details),
            details.notifiedVia
              ? t('move.notify', { channel: t(`channels.${details.notifiedVia}`) })
              : null,
          ]
            .filter(Boolean)
            .join('. '),
          action: {
            label: t('move.undo'),
            onClick: () => {
              mutation.mutate(
                {
                  bookingId: details.id,
                  staffId: previous.staffId,
                  start: previous.start,
                  expectedVersion: details.version,
                },
                {
                  onSuccess: () => {
                    toast.show({ title: t('move.undone') });
                  },
                  onError: (error) => {
                    toast.show({ title: errorMessage(t, error), tone: 'error' });
                  },
                },
              );
            },
          },
        });
      },
      onError: (error) => {
        handlers.onRefused(errorMessage(t, error), error);
      },
    });
  };

  return { move, pending: mutation.isPending };
}

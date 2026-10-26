import type { BookingStatus } from '@slotwise/domain';
import { Badge, type BadgeTone } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';

/** How each booking status reads at a glance. */
export const bookingStatusTones: Readonly<Record<BookingStatus, BadgeTone>> = {
  held: 'outline',
  confirmed: 'accent',
  completed: 'success',
  no_show: 'danger',
  cancelled: 'neutral',
};

export function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  const { t } = useTranslation();
  return (
    <Badge tone={bookingStatusTones[status]} dot>
      {t(`booking:status.${status}`)}
    </Badge>
  );
}

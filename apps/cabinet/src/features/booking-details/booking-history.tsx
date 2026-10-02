import { useFormat } from '@mestechko/booking-ui';
import type { CabinetBookingDetails } from '@mestechko/contracts/client';
import { ListGroup, ListItem } from '@mestechko/ui';
import {
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  CircleCheckBig,
  CircleX,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type HistoryEntry = CabinetBookingDetails['history'][number];

const kindIcons: Readonly<Record<HistoryEntry['kind'], LucideIcon>> = {
  rescheduled: CalendarClock,
  cancelled: CircleX,
  attendance_confirmed: CircleCheck,
  confirmed: BadgeCheck,
  completed: CircleCheckBig,
  no_show: UserX,
};

/** Changes after the booking was made: who did what, from where and when. */
export function BookingHistory({ booking }: { readonly booking: CabinetBookingDetails }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (booking.history.length === 0) {
    return null;
  }
  const when = (instant: string) =>
    `${format.instant(instant, booking.timeZone, 'weekdayDayMonth')}, ${format.instant(instant, booking.timeZone, 'time')}`;
  return (
    <ListGroup title={t('details.historyTitle')}>
      {booking.history.map((entry) => {
        const Icon = kindIcons[entry.kind];
        return (
          <ListItem
            key={`${entry.kind}-${entry.at}`}
            leading={<Icon aria-hidden="true" />}
            title={t(`details.history.${entry.kind}`)}
            description={[
              entry.previousStart
                ? t('details.previousStart', { when: when(entry.previousStart) })
                : null,
              entry.previousStaffName
                ? t('details.previousStaff', { name: entry.previousStaffName })
                : null,
              [
                entry.actorName ?? t(`details.actor.${entry.actor}`),
                entry.channel ? t(`channels.${entry.channel}`) : null,
                when(entry.at),
              ]
                .filter(Boolean)
                .join(' · '),
            ]
              .filter(Boolean)
              .join('. ')}
          />
        );
      })}
    </ListGroup>
  );
}

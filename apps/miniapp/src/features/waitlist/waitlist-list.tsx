import { errorMessage, useFormat } from '@slotwise/booking-ui';
import { IconButton, ListGroup, ListItem, useToast } from '@slotwise/ui';
import { Hourglass, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLeaveWaitlist, useWaitlist } from '../../platform/api/lifecycle-queries';

/** Days the client waits for; leaving one is a single tap. */
export function WaitlistList({ slug }: { readonly slug: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const waitlist = useWaitlist(slug);
  const leave = useLeaveWaitlist(slug);
  const items = waitlist.data?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <ListGroup title={t('waitlist.listTitle')}>
      {items.map((entry) => (
        <ListItem
          key={entry.id}
          leading={<Hourglass aria-hidden="true" />}
          title={entry.services.map((service) => service.name).join(', ')}
          description={[
            t('waitlist.entry', {
              date: format.localDate(entry.date, 'weekdayDayMonth'),
              part: t(`common:dayParts.${entry.dayPart ?? 'any'}`),
            }),
            ...(entry.staff ? [entry.staff.displayName] : []),
          ].join(' · ')}
          trailing={
            <IconButton
              label={t('waitlist.leave')}
              icon={<X />}
              disabled={leave.isPending}
              onClick={() => {
                leave.mutate(entry.id, {
                  onSuccess: () => {
                    toast.show({ title: t('waitlist.left') });
                  },
                  onError: (error) => {
                    toast.show({ title: errorMessage(t, error), tone: 'error' });
                  },
                });
              }}
            />
          }
        />
      ))}
    </ListGroup>
  );
}

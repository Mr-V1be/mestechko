import { BookingStatusBadge, useFormat } from '@slotwise/booking-ui';
import { bookingScopes, type BookingScope, type ClientBooking } from '@slotwise/contracts/client';
import {
  Button,
  EmptyIllustration,
  ListGroup,
  ListItem,
  SegmentedControl,
  SpotIllustration,
  StatePanel,
} from '@slotwise/ui';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useMyBookings } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { useCurrentBusiness } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, QueryErrorState } from '../layout/states';
import { NotificationsPrompt } from '../notifications/notifications-prompt';
import { WaitlistList } from '../waitlist/waitlist-list';
import styles from './bookings.module.css';

function DateTile({
  booking,
  upcoming,
}: {
  readonly booking: ClientBooking;
  readonly upcoming: boolean;
}) {
  const format = useFormat();
  const timeZone = booking.location.timeZone;
  return (
    <span className={clsx(styles.tile, upcoming && styles.tileUpcoming)} aria-hidden="true">
      <span className={styles.tileDay}>{format.instant(booking.start, timeZone, 'dayNumber')}</span>
      <span className={styles.tileMonth}>
        {format.instant(booking.start, timeZone, 'monthShort')}
      </span>
    </span>
  );
}

const emptyStates: Record<
  BookingScope,
  { titleKey: string; descriptionKey: string; illustration: ReactNode }
> = {
  upcoming: {
    titleKey: 'bookings.emptyUpcomingTitle',
    descriptionKey: 'bookings.emptyUpcomingDescription',
    illustration: <SpotIllustration />,
  },
  past: {
    titleKey: 'bookings.emptyPastTitle',
    descriptionKey: 'bookings.emptyPastDescription',
    illustration: <EmptyIllustration />,
  },
};

/** The client's own bookings in this business: what's ahead and what happened. */
export function BookingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const [params, setParams] = useSearchParams();
  const scope: BookingScope = params.get('scope') === 'past' ? 'past' : 'upcoming';
  const bookings = useMyBookings(business.slug, scope);
  const startPath = `/b/${encodeURIComponent(business.slug)}`;

  useMainButton({
    text: t('nav.book'),
    onClick: () => {
      void navigate(startPath);
    },
  });

  const items = bookings.data?.pages.flatMap((page) => page.items) ?? [];
  const empty = emptyStates[scope];
  return (
    <Page title={t('bookings.title')} backTo={startPath}>
      <SegmentedControl
        label={t('bookings.scopeLabel')}
        block
        value={scope}
        segments={bookingScopes.map((value) => ({ value, label: t(`bookings.${value}`) }))}
        onChange={(value) => {
          setParams(value === 'past' ? { scope: value } : {}, { replace: true });
        }}
      />
      {bookings.isPending ? <ListSkeleton rows={3} /> : null}
      {bookings.isError ? (
        <QueryErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : null}
      {bookings.data && items.length === 0 ? (
        <StatePanel
          illustration={empty.illustration}
          title={t(empty.titleKey)}
          description={t(empty.descriptionKey)}
        />
      ) : null}
      {items.length > 0 ? (
        <ListGroup>
          {items.map((booking) => (
            <ListItem
              key={booking.id}
              leading={<DateTile booking={booking} upcoming={scope === 'upcoming'} />}
              title={booking.services.map((service) => service.name).join(', ')}
              description={`${format.instant(booking.start, booking.location.timeZone, 'time')}, ${booking.staff.displayName}`}
              trailing={
                scope === 'past' || booking.status === 'held' ? (
                  <BookingStatusBadge status={booking.status} />
                ) : (
                  <ChevronRight />
                )
              }
              onClick={() => {
                void navigate(`/b/${encodeURIComponent(business.slug)}/bookings/${booking.id}`);
              }}
            />
          ))}
        </ListGroup>
      ) : null}
      {bookings.hasNextPage ? (
        <Button
          className={styles.more}
          variant="secondary"
          loading={bookings.isFetchingNextPage}
          onClick={() => void bookings.fetchNextPage()}
        >
          {t('common:actions.showMore')}
        </Button>
      ) : null}
      {scope === 'upcoming' ? (
        <>
          <WaitlistList slug={business.slug} />
          <NotificationsPrompt />
        </>
      ) : null}
    </Page>
  );
}

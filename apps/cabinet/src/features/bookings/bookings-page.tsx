import { useVocabulary } from '@slotwise/booking-ui';
import { bookingStatusIds } from '@slotwise/domain';
import {
  Button,
  EmptyIllustration,
  Skeleton,
  StatePanel,
  breakpoints,
  useMediaQuery,
} from '@slotwise/ui';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { useBookings, useOverview } from '../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { BookingDetailsSheet } from '../booking-details/booking-details-sheet';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { ALL, BookingsFilters } from './bookings-filters';
import { defaultPeriod, periodIds, periodRange } from './period';
import { BookingsCards, BookingsTable } from './bookings-views';
import styles from './bookings.module.css';

function TableSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} height="var(--size-control-lg)" />
      ))}
    </div>
  );
}

export function BookingsPage() {
  const { t } = useTranslation();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const wide = useMediaQuery(breakpoints.desktop);
  const overview = useOverview(businessId);
  const vocabulary = useVocabulary(overview.data?.business.vertical);
  const [params, setParams] = useSearchParams();
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const period = periodIds.find((id) => id === params.get('period')) ?? defaultPeriod;
  const status = bookingStatusIds.find((id) => id === params.get('status')) ?? null;
  const staffId = params.get('staff');
  const locationId = params.get('location');
  const timeZone = overview.data?.locations[0]?.timeZone ?? 'UTC';
  const range = periodRange(period, timeZone);
  const bookings = useBookings(businessId, {
    ...range,
    status,
    staffId,
    locationId,
    search: deferredSearch,
  });
  const ownOnly = membership?.access.bookings === 'own';

  if (membership && !canOpen(membership, 'bookings')) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  const setFilter = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null || value === ALL) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };
  const resetFilters = () => {
    setSearch('');
    setParams({}, { replace: true });
  };
  const rows = bookings.data?.pages.flatMap((page) => page.items) ?? [];
  const View = wide ? BookingsTable : BookingsCards;

  return (
    <PageContainer>
      <PageHeader title={t('bookings.title')} />
      <BookingsFilters
        state={{ period, status, staffId, locationId, search }}
        staff={ownOnly ? null : (overview.data?.staff ?? null)}
        staffLabel={vocabulary.staffOne}
        locations={overview.data?.locations ?? []}
        onChange={(key, value) => {
          setFilter(key, key === 'period' && value === defaultPeriod ? null : value);
        }}
        onSearch={setSearch}
        onReset={resetFilters}
      />
      {bookings.isError ? (
        <QueryErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : null}
      {bookings.isPending ? <TableSkeleton /> : null}
      {bookings.data && rows.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('bookings.emptyTitle')}
          description={t('bookings.emptyDescription')}
          action={
            <Button variant="secondary" onClick={resetFilters}>
              {t('bookings.resetFilters')}
            </Button>
          }
        />
      ) : null}
      {rows.length > 0 ? (
        <View rows={rows} staffLabel={vocabulary.staffOne} onOpen={setOpenBooking} />
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
      <BookingDetailsSheet
        businessId={businessId}
        bookingId={openBooking}
        onClose={() => {
          setOpenBooking(null);
        }}
      />
    </PageContainer>
  );
}

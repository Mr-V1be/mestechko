import { isNotFound, useVocabulary, VerticalIcon } from '@slotwise/booking-ui';
import { Skeleton } from '@slotwise/ui';
import { CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useParams } from 'react-router';
import { useBusiness } from '../../platform/api/queries';
import styles from '../layout/layout.module.css';
import { ListSkeleton, NotFoundState, QueryErrorState } from '../layout/states';
import { CurrentBusinessContext } from './business-context';

function BusinessBar() {
  const { t } = useTranslation();
  const { slug = '', locationId } = useParams();
  const business = useBusiness(slug);
  const location =
    business.data?.locations.find((candidate) => candidate.id === locationId) ?? null;
  const vocabulary = useVocabulary(business.data?.vertical);
  if (business.isError) {
    return null;
  }
  if (!business.data) {
    return (
      <div className={styles.businessBar}>
        <div className={styles.businessBarInner}>
          <Skeleton width="var(--size-control-md)" height="var(--size-control-md)" />
          <Skeleton shape="text" width="40%" />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.businessBar}>
      <div className={styles.businessBarInner}>
        <span className={styles.businessMark}>
          <VerticalIcon name={business.data.vertical.icon} />
        </span>
        <div className={styles.businessText}>
          <p className={styles.businessName}>{business.data.name}</p>
          <p className={styles.businessMeta}>{location?.name ?? vocabulary.verticalName}</p>
        </div>
        <NavLink to={`/b/${encodeURIComponent(slug)}/bookings`} className={styles.navLink ?? ''}>
          <CalendarCheck aria-hidden="true" />
          {t('nav.myBookings')}
        </NavLink>
      </div>
    </div>
  );
}

/** Every screen of a business shares its identity bar and data. */
export function BusinessLayout() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const business = useBusiness(slug);
  return (
    <>
      <BusinessBar />
      {business.isError ? (
        isNotFound(business.error) ? (
          <NotFoundState
            title={t('business.notFoundTitle')}
            description={t('business.notFoundDescription')}
          />
        ) : (
          <QueryErrorState error={business.error} onRetry={() => void business.refetch()} />
        )
      ) : null}
      {business.isPending ? (
        <div className={styles.container}>
          <ListSkeleton rows={3} />
        </div>
      ) : null}
      {business.data ? (
        <CurrentBusinessContext value={business.data}>
          <Outlet />
        </CurrentBusinessContext>
      ) : null}
    </>
  );
}

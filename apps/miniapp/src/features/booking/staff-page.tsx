import { apiAssetUrl, useFormat, useVocabulary } from '@mestechko/booking-ui';
import type { Money } from '@mestechko/contracts/client';
import { Avatar, Button, EmptyIllustration, ListGroup, ListItem, StatePanel } from '@mestechko/ui';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { appConfig } from '../../app/config';
import { useStaffOptions } from '../../platform/api/queries';
import { useCurrentBusiness, useLocation } from '../business/business-context';
import { Page } from '../layout/page';
import { ListSkeleton, QueryErrorState } from '../layout/states';
import { describeWhen } from '../../shared/when';
import { BookingSummary, BookingSummaryBar } from './booking-summary';
import { ANY_STAFF, useBookingSelection } from './selection';
import styles from './booking.module.css';

export function StaffPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const vocabulary = useVocabulary(business.vertical);
  const { selection, pathTo } = useBookingSelection();
  const location = useLocation(selection.locationId);
  const options = useStaffOptions(selection.slug, selection.locationId, selection.serviceIds);
  if (selection.serviceIds.length === 0) {
    return <Navigate to={pathTo('services')} replace />;
  }
  const timeZone = location?.timeZone ?? 'UTC';
  const choose = (staff: string) => {
    void navigate(pathTo('time', { staff, date: null, start: null }));
  };
  const nearest = (instant: string | null) =>
    instant ? (
      <span className={styles.nearest}>
        {t('staff.nearest', { when: describeWhen(t, format, instant, timeZone) })}
      </span>
    ) : (
      <span>{t('staff.noTime')}</span>
    );
  const lowest = (totals: readonly Money[]): Money | null =>
    totals.reduce<Money | null>(
      (min, total) => (min === null || total.amountMinor < min.amountMinor ? total : min),
      null,
    );
  const anyTotal = lowest(options.data?.staff.map((option) => option.total) ?? []);
  const anyHighest =
    options.data?.staff.reduce<Money | null>(
      (max, option) =>
        max === null || option.total.amountMinor > max.amountMinor ? option.total : max,
      null,
    ) ?? null;
  const varies =
    anyTotal !== null && anyHighest !== null && anyHighest.amountMinor !== anyTotal.amountMinor;

  return (
    <Page
      title={vocabulary.staffChoose}
      backTo={pathTo('services', { staff: null })}
      aside={<BookingSummary selection={selection} />}
      footer={<BookingSummaryBar selection={selection} />}
    >
      {options.isPending ? <ListSkeleton rows={4} /> : null}
      {options.isError ? (
        <QueryErrorState error={options.error} onRetry={() => void options.refetch()} />
      ) : null}
      {options.data?.staff.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('staff.emptyTitle')}
          description={t('staff.emptyDescription')}
          action={
            <Button
              variant="secondary"
              onClick={() => void navigate(pathTo('services', { staff: null }))}
            >
              {t('staff.changeServices')}
            </Button>
          }
        />
      ) : null}
      {options.data && options.data.staff.length > 0 ? (
        <>
          <ListGroup>
            <ListItem
              leading={
                <span className={styles.anyIcon}>
                  <Users aria-hidden="true" />
                </span>
              }
              title={vocabulary.staffAny}
              description={
                <span className={styles.staffLines}>
                  <span>{t('staff.anyDescription')}</span>
                  {nearest(options.data.anyNextSlot)}
                </span>
              }
              meta={
                anyTotal
                  ? varies
                    ? t('summary.range', {
                        min: format.money(anyTotal),
                        max: format.money(anyHighest),
                      })
                    : format.money(anyTotal)
                  : null
              }
              onClick={() => {
                choose(ANY_STAFF);
              }}
            />
          </ListGroup>
          <ListGroup title={vocabulary.staffMany}>
            {options.data.staff.map((option) => (
              <ListItem
                key={option.id}
                leading={
                  <Avatar
                    name={option.displayName}
                    src={apiAssetUrl(appConfig.apiBaseUrl, option.avatarUrl)}
                    size="md"
                  />
                }
                title={option.displayName}
                description={
                  <span className={styles.staffLines}>
                    {option.title ? <span>{option.title}</span> : null}
                    {nearest(option.nextSlot)}
                  </span>
                }
                meta={format.money(option.total)}
                onClick={() => {
                  choose(option.id);
                }}
              />
            ))}
          </ListGroup>
        </>
      ) : null}
    </Page>
  );
}

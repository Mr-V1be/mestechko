import { apiAssetUrl, useFormat, useVocabulary } from '@slotwise/booking-ui';
import type { BusinessReport, CabinetStaff } from '@slotwise/contracts/client';
import { Avatar, Button, EmptyIllustration, StatePanel } from '@slotwise/ui';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { appConfig } from '../../app/config';
import { useOverview } from '../../platform/api/queries';
import { useBusinessReport } from '../../platform/api/reports-queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { MetricCard } from './metric-card';
import { ALL, ReportFilters, type ReportFilterKey } from './report-filters';
import { defaultReportPeriod, reportPeriodIds, reportPeriodRange } from './report-periods';
import { ReportTiles } from './report-tiles';
import { ReportsSkeleton } from './reports-skeleton';
import { StaffBreakdown } from './staff-breakdown';
import styles from './reports.module.css';

const hasFigures = (report: BusinessReport) => Object.values(report.total).some((value) => value);

function PeriodCaption({ report }: { readonly report: BusinessReport }) {
  const { t } = useTranslation();
  const format = useFormat();
  const first = report.days.at(0)?.date;
  const last = report.days.at(-1)?.date;
  if (!first || !last) {
    return null;
  }
  const range =
    first === last
      ? format.localDate(first, 'dayMonth')
      : t('reports:range', {
          from: format.localDate(first, 'dayMonth'),
          to: format.localDate(last, 'dayMonth'),
        });
  return (
    <p className={styles.caption}>
      <span className={styles.captionRange}>{range}</span>
      {report.comparable.length > 0 ? (
        <span>{t('reports:comparedTo', { count: report.days.length })}</span>
      ) : null}
    </p>
  );
}

function OwnFiguresBadge({ member }: { readonly member: CabinetStaff }) {
  return (
    <span className={styles.person}>
      <Avatar
        name={member.displayName}
        src={apiAssetUrl(appConfig.apiBaseUrl, member.avatarUrl)}
        size="sm"
      />
      <span className={styles.personName}>{member.displayName}</span>
    </span>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const allowed = membership ? canOpen(membership, 'reports') : false;
  const overview = useOverview(businessId);
  const vocabulary = useVocabulary(overview.data?.business.vertical);
  const [params, setParams] = useSearchParams();

  const ownOnly = membership?.access.reports === 'own';
  const staff = overview.data?.staff ?? [];
  const locations = overview.data?.locations ?? [];
  const period = reportPeriodIds.find((id) => id === params.get('period')) ?? defaultReportPeriod;
  const locationId = locations.find((location) => location.id === params.get('location'))?.id;
  const staffId = ownOnly
    ? undefined
    : staff.find((member) => member.id === params.get('staff'))?.id;
  const timeZone = locations[0]?.timeZone;
  const range = timeZone ? reportPeriodRange(period, timeZone) : null;
  const report = useBusinessReport(
    businessId,
    range && allowed
      ? { ...range, locationId: locationId ?? null, staffId: staffId ?? null }
      : null,
  );

  if (membership && !allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  const filtered =
    period !== defaultReportPeriod || locationId !== undefined || staffId !== undefined;
  const setFilter = (key: ReportFilterKey, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === ALL || (key === 'period' && value === defaultReportPeriod)) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };
  const ownProfile = ownOnly ? staff.find((member) => member.id === membership.staffId) : undefined;
  const data = report.data;
  // A failed background refresh keeps the figures already on screen.
  const error = data ? null : (overview.error ?? report.error);

  return (
    <PageContainer>
      <PageHeader
        title={t('reports:title')}
        actions={ownProfile ? <OwnFiguresBadge member={ownProfile} /> : null}
      />
      <ReportFilters
        period={period}
        locationId={locationId ?? null}
        staffId={staffId ?? null}
        locations={locations}
        staff={ownOnly ? null : staff}
        staffLabel={vocabulary.staffOne}
        onChange={setFilter}
      />
      {error ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void (overview.isError ? overview.refetch() : report.refetch());
          }}
        />
      ) : null}
      {!error && !data ? <ReportsSkeleton /> : null}
      {!error && data && !hasFigures(data) ? (
        <StatePanel
          compact
          illustration={<EmptyIllustration />}
          title={t('reports:emptyTitle')}
          description={t('reports:emptyDescription')}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({}, { replace: true });
                }}
              >
                {t('reports:showDefault')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {!error && data && hasFigures(data) ? (
        <div
          className={clsx(styles.content, report.isPlaceholderData && styles.stale)}
          aria-busy={report.isPlaceholderData}
        >
          <PeriodCaption report={data} />
          <ReportTiles report={data} />
          <div className={styles.charts}>
            {data.metrics.map((metric) => (
              <MetricCard key={metric} metric={metric} report={data} />
            ))}
          </div>
          {data.staff.length > 1 ? (
            <StaffBreakdown
              report={data}
              staff={staff}
              title={vocabulary.staffMany}
              personLabel={vocabulary.staffOne}
            />
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}

import { apiAssetUrl, useFormat } from '@mestechko/booking-ui';
import type { BusinessReport, CabinetStaff, ReportFacts } from '@mestechko/contracts/client';
import { emptyFacts, metricValue } from '@mestechko/domain';
import { Avatar, DataTable, type DataColumn } from '@mestechko/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { useMetricFormat } from './use-metric-format';
import styles from './reports.module.css';

interface StaffRow {
  readonly key: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly facts: ReportFacts;
  /** Money not paid for anyone's visits, e.g. pass sales: it has no time or visits. */
  readonly moneyOnly: boolean;
}

/** Each staff member's period side by side, with the business's totals below. */
export function StaffBreakdown({
  report,
  staff,
  title,
  personLabel,
}: {
  readonly report: BusinessReport;
  /** Reference data for avatars. */
  readonly staff: readonly CabinetStaff[];
  /** «Мастера», «Врачи»: the vertical's word for the team. */
  readonly title: string;
  readonly personLabel: string;
}) {
  const { t } = useTranslation();
  const format = useMetricFormat(report.currency);
  const formatters = useFormat();
  const headingId = useId();
  const avatars = new Map(staff.map((member) => [member.id, member.avatarUrl]));
  const rows: StaffRow[] = report.staff.map((member) => ({
    key: member.staffId,
    name: member.displayName,
    avatarUrl: avatars.get(member.staffId) ?? null,
    facts: member,
    moneyOnly: false,
  }));
  const unattributed =
    report.total.revenueMinor - rows.reduce((sum, row) => sum + row.facts.revenueMinor, 0);
  if (unattributed > 0) {
    rows.push({
      key: 'other-income',
      name: t('reports:staff.otherIncome'),
      avatarUrl: null,
      facts: { ...emptyFacts, revenueMinor: unattributed },
      moneyOnly: true,
    });
  }
  const unlessMoneyOnly = (row: StaffRow, value: string) =>
    row.moneyOnly ? t('reports:noValue') : value;

  const columns: DataColumn<StaffRow>[] = [
    {
      key: 'name',
      header: personLabel,
      sticky: true,
      cell: (row) => (
        <span className={styles.person}>
          {row.avatarUrl ? (
            <Avatar
              name={row.name}
              src={apiAssetUrl(appConfig.apiBaseUrl, row.avatarUrl)}
              size="sm"
            />
          ) : null}
          <span className={styles.personName}>{row.name}</span>
        </span>
      ),
    },
    {
      key: 'occupancy',
      header: t('reports:staff.occupancy'),
      numeric: true,
      cell: (row) =>
        unlessMoneyOnly(row, format.value('occupancy', metricValue('occupancy', row.facts))),
    },
    {
      key: 'visits',
      header: t('reports:staff.visits'),
      numeric: true,
      cell: (row) => unlessMoneyOnly(row, formatters.number(row.facts.visits)),
    },
    {
      key: 'noShows',
      header: t('reports:staff.noShows'),
      numeric: true,
      cell: (row) =>
        unlessMoneyOnly(row, format.value('no_shows', metricValue('no_shows', row.facts))),
    },
    {
      key: 'revenue',
      header: t('reports:staff.revenue'),
      numeric: true,
      cell: (row) => format.value('revenue', row.facts.revenueMinor),
    },
  ];

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      <DataTable<StaffRow>
        caption={t('reports:staff.caption')}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        footer={{
          key: 'total',
          name: t('reports:staff.total'),
          avatarUrl: null,
          facts: report.total,
          moneyOnly: false,
        }}
      />
    </section>
  );
}

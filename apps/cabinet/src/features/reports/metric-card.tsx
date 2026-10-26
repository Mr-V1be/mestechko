import type { BusinessReport, ReportFacts } from '@slotwise/contracts/client';
import { metricValue, reportMetrics, type ReportMetric } from '@slotwise/domain';
import { BarChart, DataTable, SegmentedControl, type DataColumn } from '@slotwise/ui';
import { ChartColumn, Table2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metricViews } from './metric-views';
import { useMetricFormat, type MetricFormat } from './use-metric-format';
import styles from './reports.module.css';

type MetricView = 'chart' | 'table';

interface DayRow {
  readonly key: string;
  readonly label: string;
  readonly facts: ReportFacts;
}

/** Shares are drawn on their full scale, so a day at 40 % looks like 40 %. */
const SHARE_SCALE_TOP = 1;

function dayColumns(
  metric: ReportMetric,
  title: string,
  format: MetricFormat,
  t: (key: string) => string,
): DataColumn<DayRow>[] {
  const amounts = metricViews[metric].amounts;
  const parts = (row: DayRow) => reportMetrics[metric].parts(row.facts);
  return [
    { key: 'date', header: t('reports:table.date'), cell: (row) => row.label, sticky: true },
    {
      key: 'value',
      header: title,
      numeric: true,
      cell: (row) => format.value(metric, metricValue(metric, row.facts)),
    },
    ...(amounts
      ? [
          {
            key: 'part',
            header: t(`reports:metrics.${metric}.part`),
            numeric: true,
            cell: (row: DayRow) => format.amount(amounts, parts(row).part),
          },
          {
            key: 'whole',
            header: t(`reports:metrics.${metric}.whole`),
            numeric: true,
            cell: (row: DayRow) => format.amount(amounts, parts(row).whole),
          },
        ]
      : []),
  ];
}

/** One metric per day of the period: a bar chart, or the same figures as a table. */
export function MetricCard({
  metric,
  report,
}: {
  readonly metric: ReportMetric;
  readonly report: BusinessReport;
}) {
  const { t } = useTranslation();
  const format = useMetricFormat(report.currency);
  const [view, setView] = useState<MetricView>('chart');
  const headingId = useId();
  const title = t(`reports:metrics.${metric}.title`);
  const periodDays = report.days.length;

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <header className={styles.cardHeader}>
        <h2 id={headingId} className={styles.cardTitle}>
          {title}
        </h2>
        <SegmentedControl<MetricView>
          label={t('reports:view.label')}
          value={view}
          segments={[
            { value: 'chart', label: t('reports:view.chart'), icon: <ChartColumn /> },
            { value: 'table', label: t('reports:view.table'), icon: <Table2 /> },
          ]}
          onChange={setView}
        />
      </header>
      {view === 'chart' ? (
        <BarChart
          label={title}
          points={report.days.map((day) => ({
            key: day.date,
            label: format.dayLabel(day.date, periodDays),
            title: format.dayTitle(day.date),
            value: metricValue(metric, day),
          }))}
          format={format.axis(metric)}
          {...(reportMetrics[metric].unit === 'share' ? { max: SHARE_SCALE_TOP } : {})}
          emptyLabel={t('reports:noValue')}
        />
      ) : (
        <DataTable<DayRow>
          caption={t('reports:table.caption', { metric: title })}
          className={styles.dayTable}
          columns={dayColumns(metric, title, format, t)}
          rows={report.days.map((day) => ({
            key: day.date,
            label: format.dayShort(day.date),
            facts: day,
          }))}
          rowKey={(row) => row.key}
          footer={{ key: 'total', label: t('reports:table.total'), facts: report.total }}
        />
      )}
    </section>
  );
}

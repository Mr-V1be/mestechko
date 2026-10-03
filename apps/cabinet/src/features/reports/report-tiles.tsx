import type { BusinessReport } from '@mestechko/contracts/client';
import { metricChange, metricValue } from '@mestechko/domain';
import { StatTile } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { metricViews } from './metric-views';
import { useMetricFormat } from './use-metric-format';
import styles from './reports.module.css';

/** The period's key figures, each against the same number of days before it. */
export function ReportTiles({ report }: { readonly report: BusinessReport }) {
  const { t } = useTranslation();
  const format = useMetricFormat(report.currency);
  return (
    <div className={styles.tiles}>
      {report.metrics.map((metric) => {
        const Icon = metricViews[metric].icon;
        const previous = metricValue(metric, report.previous);
        return (
          <StatTile
            key={metric}
            label={t(`reports:metrics.${metric}.title`)}
            icon={<Icon aria-hidden="true" />}
            value={format.value(metric, metricValue(metric, report.total))}
            delta={format.change(metricChange(metric, report.total, report.previous))}
            hint={
              previous === null
                ? null
                : t('reports:previous', { value: format.value(metric, previous) })
            }
          />
        );
      })}
    </div>
  );
}

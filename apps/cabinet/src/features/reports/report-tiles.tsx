import type { BusinessReport } from '@slotwise/contracts/client';
import { metricChange, metricValue } from '@slotwise/domain';
import { StatTile } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { metricViews } from './metric-views';
import { useMetricFormat } from './use-metric-format';
import styles from './reports.module.css';

/**
 * The period's key figures, each against the same number of days before it when the
 * records reach back far enough for a fair comparison.
 */
export function ReportTiles({ report }: { readonly report: BusinessReport }) {
  const { t } = useTranslation();
  const format = useMetricFormat(report.currency);
  return (
    <div className={styles.tiles}>
      {report.metrics.map((metric) => {
        const Icon = metricViews[metric].icon;
        const comparable = report.comparable.includes(metric);
        const previous = comparable ? metricValue(metric, report.previous) : null;
        return (
          <StatTile
            key={metric}
            label={t(`reports:metrics.${metric}.title`)}
            icon={<Icon aria-hidden="true" />}
            value={format.value(metric, metricValue(metric, report.total))}
            delta={
              comparable ? format.change(metricChange(metric, report.total, report.previous)) : null
            }
            hint={
              comparable
                ? previous === null
                  ? null
                  : t('reports:previous', { value: format.value(metric, previous) })
                : t('reports:noComparison')
            }
          />
        );
      })}
    </div>
  );
}

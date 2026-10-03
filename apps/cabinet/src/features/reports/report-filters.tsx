import type { CabinetStaff, Location } from '@mestechko/contracts/client';
import { Select } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { reportPeriodIds, type ReportPeriodId } from './report-periods';
import styles from './reports.module.css';

/** Value of the «all» option in the location and staff choices. */
export const ALL = 'all';

export type ReportFilterKey = 'period' | 'location' | 'staff';

export interface ReportFiltersProps {
  readonly period: ReportPeriodId;
  readonly locationId: string | null;
  readonly staffId: string | null;
  readonly locations: readonly Location[];
  /** `null` hides the choice, e.g. for a staff member who only sees their own figures. */
  readonly staff: readonly CabinetStaff[] | null;
  readonly staffLabel: string;
  readonly onChange: (key: ReportFilterKey, value: string) => void;
}

/** Period first; location and staff only when there is something to choose. */
export function ReportFilters({
  period,
  locationId,
  staffId,
  locations,
  staff,
  staffLabel,
  onChange,
}: ReportFiltersProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.filters}>
      <Select<ReportPeriodId>
        className={styles.periodFilter}
        label={t('reports:filters.period')}
        value={period}
        options={reportPeriodIds.map((id) => ({ value: id, label: t(`reports:periods.${id}`) }))}
        onChange={(value) => {
          onChange('period', value);
        }}
      />
      {locations.length > 1 ? (
        <Select
          label={t('reports:filters.location')}
          value={locationId ?? ALL}
          options={[
            { value: ALL, label: t('reports:filters.allLocations') },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          onChange={(value) => {
            onChange('location', value);
          }}
        />
      ) : null}
      {staff && staff.length > 1 ? (
        <Select
          label={staffLabel}
          value={staffId ?? ALL}
          options={[
            { value: ALL, label: t('reports:filters.allStaff') },
            ...staff.map((member) => ({ value: member.id, label: member.displayName })),
          ]}
          onChange={(value) => {
            onChange('staff', value);
          }}
        />
      ) : null}
    </div>
  );
}

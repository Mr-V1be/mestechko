import type { CabinetStaff, Location } from '@mestechko/contracts/client';
import { bookingStatusIds, type BookingStatus } from '@mestechko/domain';
import { Button, Select, Sheet, TextField, breakpoints, useMediaQuery } from '@mestechko/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { periodIds, type PeriodId } from './period';
import styles from './bookings.module.css';

export const ALL = 'all';

export interface BookingsFilterState {
  readonly period: PeriodId;
  readonly status: BookingStatus | null;
  readonly staffId: string | null;
  readonly locationId: string | null;
  readonly search: string;
}

export interface BookingsFiltersProps {
  readonly state: BookingsFilterState;
  /** `null` hides the staff filter, e.g. for roles that only see their own bookings. */
  readonly staff: readonly CabinetStaff[] | null;
  readonly staffLabel: string;
  readonly locations: readonly Location[];
  readonly onChange: (
    key: 'period' | 'status' | 'staff' | 'location',
    value: string | null,
  ) => void;
  readonly onSearch: (value: string) => void;
  readonly onReset: () => void;
}

/**
 * Period and search are always at hand; the rest live inline on wide screens and in a
 * sheet on phones, so the list stays the first thing in view.
 */
export function BookingsFilters({
  state,
  staff,
  staffLabel,
  locations,
  onChange,
  onSearch,
  onReset,
}: BookingsFiltersProps) {
  const { t } = useTranslation();
  const wide = useMediaQuery(breakpoints.tablet);
  const [sheetOpen, setSheetOpen] = useState(false);
  const secondary: ReactNode[] = [
    <Select<BookingStatus | typeof ALL>
      key="status"
      label={t('bookings.status')}
      value={state.status ?? ALL}
      options={[
        { value: ALL, label: t('bookings.allStatuses') },
        ...bookingStatusIds.map((id) => ({ value: id, label: t(`booking:status.${id}`) })),
      ]}
      onChange={(value) => {
        onChange('status', value);
      }}
    />,
    staff ? (
      <Select
        key="staff"
        label={staffLabel}
        value={state.staffId ?? ALL}
        options={[
          { value: ALL, label: t('bookings.allStaff') },
          ...staff.map((member) => ({ value: member.id, label: member.displayName })),
        ]}
        onChange={(value) => {
          onChange('staff', value);
        }}
      />
    ) : null,
    locations.length > 1 ? (
      <Select
        key="location"
        label={t('bookings.location')}
        value={state.locationId ?? ALL}
        options={[
          { value: ALL, label: t('bookings.allLocations') },
          ...locations.map((location) => ({ value: location.id, label: location.name })),
        ]}
        onChange={(value) => {
          onChange('location', value);
        }}
      />
    ) : null,
  ];
  const activeCount = [state.status, state.staffId, state.locationId].filter(
    (value) => value !== null,
  ).length;
  const period = (
    <Select<PeriodId>
      label={t('bookings.period')}
      value={state.period}
      options={periodIds.map((id) => ({ value: id, label: t(`bookings.periods.${id}`) }))}
      onChange={(value) => {
        onChange('period', value);
      }}
    />
  );
  const search = (
    <TextField
      label={t('bookings.search')}
      type="search"
      placeholder={t('bookings.searchPlaceholder')}
      value={state.search}
      onChange={(event) => {
        onSearch(event.target.value);
      }}
    />
  );
  if (wide) {
    return (
      <div className={styles.filters}>
        {period}
        {secondary}
        {search}
      </div>
    );
  }
  return (
    <div className={styles.filtersCompact}>
      {search}
      <div className={styles.filtersRow}>
        {period}
        <Button
          variant="secondary"
          icon={<SlidersHorizontal />}
          onClick={() => {
            setSheetOpen(true);
          }}
        >
          {activeCount > 0
            ? t('bookings.filtersActive', { count: activeCount })
            : t('bookings.filters')}
        </Button>
      </div>
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t('bookings.filters')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="ghost" block onClick={onReset}>
              {t('bookings.resetFilters')}
            </Button>
            <Button
              block
              onClick={() => {
                setSheetOpen(false);
              }}
            >
              {t('bookings.apply')}
            </Button>
          </>
        }
      >
        <div className={styles.sheetFields}>{secondary}</div>
      </Sheet>
    </div>
  );
}

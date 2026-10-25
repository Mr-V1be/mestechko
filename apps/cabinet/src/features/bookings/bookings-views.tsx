import { apiAssetUrl, BookingStatusBadge, formatPhone, useFormat } from '@mestechko/booking-ui';
import type { CabinetBookingRow } from '@mestechko/contracts/client';
import { Avatar, ListGroup, ListItem } from '@mestechko/ui';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { localDateOf } from '../schedule/timeline-model';
import styles from './bookings.module.css';

interface BookingsViewProps {
  readonly rows: readonly CabinetBookingRow[];
  readonly staffLabel: string;
  readonly onOpen: (bookingId: string) => void;
}

/** Wide screens: a table with columns to scan and compare. */
export function BookingsTable({ rows, staffLabel, onOpen }: BookingsViewProps) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.fit}>
              {t('bookings.columns.when')}
            </th>
            <th scope="col" className={styles.fit}>
              {t('bookings.columns.client')}
            </th>
            <th scope="col">{t('bookings.columns.services')}</th>
            <th scope="col" className={styles.fit}>
              {staffLabel}
            </th>
            <th scope="col" className={styles.fit}>
              {t('bookings.columns.status')}
            </th>
            <th scope="col" className={clsx(styles.numeric, styles.fit)}>
              {t('bookings.columns.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => {
                onOpen(row.id);
              }}
            >
              <td className={clsx(styles.when, styles.fit)}>
                {format.instantRange(row.start, row.end, row.timeZone, 'time')}
                <span className={styles.whenDate}>
                  {format.instant(row.start, row.timeZone, 'weekdayDayMonth')}
                </span>
              </td>
              <td className={styles.fit}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  {row.client.displayName}
                </button>
                {row.client.phone ? (
                  <div className={styles.secondary}>{formatPhone(row.client.phone)}</div>
                ) : null}
              </td>
              <td className={styles.fill}>
                <div
                  className={styles.services}
                  title={row.services.map((service) => service.name).join(', ')}
                >
                  {row.services.map((service) => service.name).join(', ')}
                </div>
              </td>
              <td className={styles.fit}>
                <span className={styles.staffCell}>
                  <Avatar
                    name={row.staff.displayName}
                    src={apiAssetUrl(appConfig.apiBaseUrl, row.staff.avatarUrl)}
                    size="sm"
                  />
                  {row.staff.displayName}
                </span>
              </td>
              <td className={styles.fit}>
                <BookingStatusBadge status={row.status} />
              </td>
              <td className={clsx(styles.numeric, styles.fit)}>{format.money(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: bookings grouped by day as tappable rows. */
export function BookingsCards({ rows, onOpen }: BookingsViewProps) {
  const format = useFormat();
  const days = new Map<string, CabinetBookingRow[]>();
  for (const row of rows) {
    const date = localDateOf(row.start, row.timeZone);
    days.set(date, [...(days.get(date) ?? []), row]);
  }
  return (
    <div className={styles.cards}>
      {[...days.entries()].map(([date, dayRows]) => (
        <ListGroup key={date} title={format.localDate(date, 'weekdayDayMonth')}>
          {dayRows.map((row) => (
            <ListItem
              key={row.id}
              leading={
                <Avatar
                  name={row.staff.displayName}
                  src={apiAssetUrl(appConfig.apiBaseUrl, row.staff.avatarUrl)}
                  size="sm"
                />
              }
              title={`${format.instant(row.start, row.timeZone, 'time')}, ${row.client.displayName}`}
              description={row.services.map((service) => service.name).join(', ')}
              trailing={<BookingStatusBadge status={row.status} />}
              onClick={() => {
                onOpen(row.id);
              }}
            />
          ))}
        </ListGroup>
      ))}
    </div>
  );
}

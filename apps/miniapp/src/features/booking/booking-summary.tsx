import { useFormat, useVocabulary } from '@mestechko/booking-ui';
import { CalendarClock, MapPin, Scissors, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentBusiness, useLocation } from '../business/business-context';
import { useBookingDraft } from './booking-details';
import { priceText } from './price-text';
import type { BookingSelection } from './selection';
import styles from './booking.module.css';

function Row({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
  return (
    <div className={styles.summaryRow}>
      {icon}
      <div className={styles.summaryValue}>{children}</div>
    </div>
  );
}

/** The booking taking shape, beside the steps on wide screens. */
export function BookingSummary({ selection }: { readonly selection: BookingSelection }) {
  const { t } = useTranslation();
  const format = useFormat();
  const business = useCurrentBusiness();
  const location = useLocation(selection.locationId);
  const vocabulary = useVocabulary(business.vertical);
  const draft = useBookingDraft(selection);
  const timeZone = location?.timeZone ?? 'UTC';
  return (
    <section className={styles.summary} aria-label={t('summary.title')}>
      <h2 className={styles.summaryTitle}>{t('summary.title')}</h2>
      <div className={styles.summaryRows}>
        {location ? (
          <Row icon={<MapPin aria-hidden="true" />}>
            {location.name}
            <div className={styles.summaryHint}>{location.address}</div>
          </Row>
        ) : null}
        {draft.services.length > 0 ? (
          <Row icon={<Scissors aria-hidden="true" />}>
            {draft.services.map((service) => service.name).join(', ')}
            <div className={styles.summaryHint}>{format.duration(draft.durationMinutes)}</div>
          </Row>
        ) : (
          <p className={styles.summaryHint}>{t('summary.nothingYet')}</p>
        )}
        {draft.staff || draft.anyStaff ? (
          <Row icon={<UserRound aria-hidden="true" />}>
            {draft.staff?.displayName ??
              draft.quote?.assigned?.staff.displayName ??
              vocabulary.staffAny}
          </Row>
        ) : null}
        {selection.start ? (
          <Row icon={<CalendarClock aria-hidden="true" />}>
            {format.instant(selection.start, timeZone, 'weekdayDayMonth')}
            <div className={styles.summaryHint}>
              {format.instant(selection.start, timeZone, 'time')}
            </div>
          </Row>
        ) : null}
      </div>
      {draft.price && draft.services.length > 0 ? (
        <div className={styles.summaryTotal}>
          <span>{t('summary.total')}</span>
          <span>{priceText(t, format, draft.price)}</span>
        </div>
      ) : null}
    </section>
  );
}

/** Compact summary above the main button on phones and tablets. */
export function BookingSummaryBar({ selection }: { readonly selection: BookingSelection }) {
  const { t } = useTranslation();
  const format = useFormat();
  const draft = useBookingDraft(selection);
  if (draft.services.length === 0 || !draft.price) {
    return null;
  }
  return (
    <div className={styles.bar} role="status">
      <span className={styles.barText}>
        <span className={styles.barStrong}>
          {t('summary.services', { count: draft.services.length })}
        </span>
        {format.duration(draft.durationMinutes)}
      </span>
      <span className={styles.barPrice}>{priceText(t, format, draft.price)}</span>
    </div>
  );
}

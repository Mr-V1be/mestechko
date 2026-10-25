import { useFormat, useLocale, type Formatters } from '@mestechko/booking-ui';
import { locales } from '@mestechko/domain';
import type { ScheduleColumn } from '@mestechko/contracts/client';
import { Button, DateStrip, DeviceFrame, TimeGrid } from '@mestechko/ui';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColumnHeader } from '../schedule/schedule-columns';
import { TimelineGrid } from '../schedule/timeline-grid';
import { addDays, todayIn, type TimelineColumn } from '../schedule/timeline-model';
import {
  SHOWCASE_NOW_MINUTE,
  showcasePhone,
  showcaseStaff,
  showcaseVertical,
  type ShowcaseStaff,
} from './showcase-sample';
import styles from './product-showcase.module.css';

type Translate = ReturnType<typeof useTranslation>['t'];

const SHOWCASE_TIME_ZONE = 'Europe/Moscow';
const ignore = () => undefined;

function serviceName(t: Translate, serviceKey: string): string {
  return t(`catalog:services.${showcaseVertical.id}.${serviceKey}.name`);
}

function staffName(t: Translate, staffKey: string): string {
  return t(`signIn.showcase.staff.${staffKey}.name`);
}

function toColumn(t: Translate, format: Formatters, member: ShowcaseStaff): TimelineColumn {
  const column: ScheduleColumn = {
    id: member.key,
    kind: 'staff',
    title: staffName(t, member.key),
    subtitle: t(`signIn.showcase.staff.${member.key}.title`),
    avatarUrl: `/v1/avatars/${member.avatarSeed}.svg`,
    typeTerm: null,
  };
  return {
    key: member.key,
    header: <ColumnHeader column={column} vertical={showcaseVertical} />,
    working: [member.working],
    blocks: member.visits.map((visit) => ({
      id: `${member.key}-${String(visit.start)}`,
      version: 1,
      staffId: member.key,
      status: visit.status,
      held: false,
      movable: false,
      service: { start: visit.start, end: visit.end },
      occupied: { start: visit.start, end: visit.end + visit.afterMinutes },
      timeLabel: format.wallTimeRange(visit.start, visit.end),
      startLabel: format.wallTime(visit.start),
      client: t(`signIn.showcase.clients.${visit.clientKey}`),
      services: serviceName(t, visit.serviceKey),
    })),
    nowMinute: SHOWCASE_NOW_MINUTE,
  };
}

function ScheduleFragment() {
  const { t } = useTranslation();
  const format = useFormat();
  const today = todayIn(SHOWCASE_TIME_ZONE);
  return (
    <div className={styles.board}>
      <div className={styles.boardHeader}>
        <span className={styles.boardDate}>{format.localDate(today, 'weekdayDayMonth')}</span>
        <span className={styles.boardTitle}>{t('signIn.showcase.scheduleTitle')}</span>
      </div>
      <TimelineGrid
        columns={showcaseStaff.map((member) => toColumn(t, format, member))}
        columnsLabel={t('signIn.showcase.scheduleTitle')}
        density="compact"
        onOpenBooking={ignore}
      />
    </div>
  );
}

function PhoneScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const { locale } = useLocale();
  const today = todayIn(SHOWCASE_TIME_ZONE);
  const chosenDay = addDays(today, showcasePhone.chosenDayOffset);
  const days = Array.from({ length: showcasePhone.daysShown }, (_, offset) => {
    const date = addDays(today, offset);
    return {
      value: date,
      weekday: format.localDate(date, 'weekdayShort'),
      dayNumber: format.localDate(date, 'dayNumber'),
      accessibleLabel: format.localDate(date, 'weekdayDayMonth'),
      disabled: false,
      marked: true,
      today: offset === 0,
    };
  });
  const price = format.money(showcasePhone.prices[locales[locale].marketCurrency]);
  return (
    <DeviceFrame kind="phone" className={styles.phone}>
      <div className={styles.screen}>
        <div className={styles.appBar}>
          <ChevronLeft aria-hidden="true" />
          <span>{t('signIn.showcase.business')}</span>
        </div>
        <div className={styles.screenHeading}>
          <span className={styles.screenTitle}>{t('signIn.showcase.chooseTime')}</span>
          <span className={styles.screenSummary}>
            {t('signIn.showcase.summary', {
              staff: staffName(t, showcasePhone.staffKey),
              service: serviceName(t, showcasePhone.serviceKey),
            })}
          </span>
        </div>
        <DateStrip
          label={t('signIn.showcase.chooseTime')}
          days={days}
          value={chosenDay}
          onChange={ignore}
        />
        <TimeGrid
          label={t('signIn.showcase.chooseTime')}
          groups={showcasePhone.slots.map((group) => ({
            key: group.groupKey,
            title: t(`signIn.showcase.${group.groupKey}`),
            options: group.starts.map((start) => ({
              value: String(start),
              label: format.wallTime(start),
            })),
          }))}
          value={String(showcasePhone.chosenStart)}
          onChange={ignore}
        />
        <div className={styles.mainButton}>
          <Button block size="lg">
            {t('signIn.showcase.book', { price })}
          </Button>
        </div>
      </div>
    </DeviceFrame>
  );
}

/**
 * The product at a glance, built from the real schedule and booking components on
 * test data: a client picking a time in the Mini App and the salon's day in the
 * cabinet. Decorative, so it is hidden from assistive technology and inert.
 */
export function ProductShowcase() {
  return (
    <div className={styles.showcase} aria-hidden="true" inert>
      <ScheduleFragment />
      <PhoneScreen />
    </div>
  );
}

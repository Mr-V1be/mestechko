import { apiAssetUrl, BookingStatusBadge, useFormat } from '@slotwise/booking-ui';
import type { CabinetBookingRow, ClientCard } from '@slotwise/contracts/client';
import { Avatar, Button, ListGroup, ListItem } from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../../app/config';
import { useClientDates } from '../client-dates';
import styles from './card.module.css';

/** Past visits shown before «show all»: enough to see the pattern, short on a phone. */
const HISTORY_PREVIEW = 5;

function VisitRow({
  visit,
  onOpen,
}: {
  readonly visit: CabinetBookingRow;
  readonly onOpen: (bookingId: string) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const dates = useClientDates(visit.timeZone);
  return (
    <ListItem
      leading={
        <Avatar
          name={visit.staff.displayName}
          src={apiAssetUrl(appConfig.apiBaseUrl, visit.staff.avatarUrl)}
          size="sm"
        />
      }
      title={
        <span className={styles.visitTitle}>
          <span className={styles.figures}>{dates.dayTime(visit.start)}</span>
          <BookingStatusBadge status={visit.status} />
        </span>
      }
      description={t('clients:card.visitDetails', {
        services: visit.services.map((service) => service.name).join(', '),
        staff: visit.staff.displayName,
      })}
      meta={format.money(visit.total)}
      onClick={() => {
        onOpen(visit.id);
      }}
    />
  );
}

function EmptyRow({ text }: { readonly text: string }) {
  return <ListItem title={<span className={styles.emptyRow}>{text}</span>} />;
}

/** Coming visits and the history; each opens the booking's details. */
export function VisitsPanel({
  card,
  onOpen,
}: {
  readonly card: ClientCard;
  readonly onOpen: (bookingId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const history = expanded ? card.history : card.history.slice(0, HISTORY_PREVIEW);
  return (
    <div className={styles.stack}>
      <ListGroup title={t('clients:card.upcoming')}>
        {card.upcoming.length > 0 ? (
          card.upcoming.map((visit) => <VisitRow key={visit.id} visit={visit} onOpen={onOpen} />)
        ) : (
          <EmptyRow text={t('clients:card.noUpcoming')} />
        )}
      </ListGroup>
      <ListGroup title={t('clients:card.history')}>
        {history.length > 0 ? (
          history.map((visit) => <VisitRow key={visit.id} visit={visit} onOpen={onOpen} />)
        ) : (
          <EmptyRow text={t('clients:card.noHistory')} />
        )}
      </ListGroup>
      {card.history.length > HISTORY_PREVIEW ? (
        <Button
          className={styles.toggle}
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((value) => !value);
          }}
        >
          {expanded
            ? t('clients:card.showLess')
            : t('clients:card.showAll', { count: card.history.length })}
        </Button>
      ) : null}
    </div>
  );
}

import { formatPhone, useFormat } from '@mestechko/booking-ui';
import type { ClientCard } from '@mestechko/contracts/client';
import { ListGroup, ListItem, StatTile } from '@mestechko/ui';
import { CalendarCheck, CalendarX, Mail, Phone, UserX, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './card.module.css';

/** Opens the device's own app for a contact: the dialer or the mail client. */
function openContact(href: string): void {
  window.open(href, '_self');
}

/** How to reach the client and the card's key figures. */
export function CardOverview({
  card,
  onEdit,
}: {
  readonly card: ClientCard;
  readonly onEdit: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const { client, stats } = card;
  const addition = (text: string) => <span className={styles.addition}>{text}</span>;
  return (
    <>
      <ListGroup title={t('clients:card.contacts')}>
        {client.phone ? (
          <ListItem
            leading={<Phone aria-hidden="true" />}
            title={<span className={styles.figures}>{formatPhone(client.phone)}</span>}
            description={t('clients:card.call')}
            onClick={() => {
              openContact(`tel:${client.phone ?? ''}`);
            }}
          />
        ) : (
          <ListItem
            leading={<Phone aria-hidden="true" />}
            title={addition(t('clients:card.addPhone'))}
            onClick={onEdit}
          />
        )}
        {client.email ? (
          <ListItem
            leading={<Mail aria-hidden="true" />}
            title={client.email}
            description={t('clients:card.write')}
            onClick={() => {
              openContact(`mailto:${client.email ?? ''}`);
            }}
          />
        ) : (
          <ListItem
            leading={<Mail aria-hidden="true" />}
            title={addition(t('clients:card.addEmail'))}
            onClick={onEdit}
          />
        )}
      </ListGroup>
      <div className={styles.stats}>
        <StatTile
          icon={<CalendarCheck />}
          label={t('clients:card.stats.visits')}
          value={stats.visits}
        />
        <StatTile
          icon={<UserX />}
          label={t('clients:card.stats.noShows')}
          value={
            <span className={stats.noShows > 0 ? styles.danger : undefined}>{stats.noShows}</span>
          }
        />
        <StatTile
          icon={<CalendarX />}
          label={t('clients:card.stats.cancellations')}
          value={stats.cancellations}
        />
        <div className={styles.spent}>
          <StatTile
            icon={<Wallet />}
            label={t('clients:card.stats.spent')}
            value={format.money(stats.spent)}
          />
        </div>
      </div>
    </>
  );
}

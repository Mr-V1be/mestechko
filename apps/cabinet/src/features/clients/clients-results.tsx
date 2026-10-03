import { formatPhone } from '@mestechko/booking-ui';
import type { ClientSummary } from '@mestechko/contracts/client';
import {
  Avatar,
  Badge,
  DataTable,
  ListGroup,
  ListItem,
  Skeleton,
  type DataColumn,
} from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useClientDates } from './client-dates';
import styles from './clients.module.css';

export interface ClientsViewProps {
  readonly rows: readonly ClientSummary[];
  readonly timeZone: string;
  readonly onOpen: (clientId: string) => void;
}

const SKELETON_ROWS = 8;

function TagBadges({ tags }: { readonly tags: readonly string[] }) {
  return tags.length > 0 ? (
    <span className={styles.tags}>
      {tags.map((tag) => (
        <Badge key={tag}>{tag}</Badge>
      ))}
    </span>
  ) : null;
}

function NoShows({ count }: { readonly count: number }) {
  return <span className={count > 0 ? styles.noShows : styles.quiet}>{count}</span>;
}

/** Wide screens: columns to scan and compare; a row opens the card. */
export function ClientsTable({ rows, timeZone, onOpen }: ClientsViewProps) {
  const { t } = useTranslation();
  const dates = useClientDates(timeZone);
  const none = <span className={styles.quiet}>{t('clients:none')}</span>;
  const columns: DataColumn<ClientSummary>[] = [
    {
      key: 'client',
      header: t('clients:columns.client'),
      cell: (client) => (
        <span className={styles.clientCell}>
          <span className={styles.clientName}>{client.displayName}</span>
          <TagBadges tags={client.tags} />
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('clients:columns.phone'),
      cell: (client) =>
        client.phone ? <span className={styles.figures}>{formatPhone(client.phone)}</span> : none,
    },
    {
      key: 'visits',
      header: t('clients:columns.visits'),
      cell: (client) => client.visits,
      numeric: true,
    },
    {
      key: 'noShows',
      header: t('clients:columns.noShows'),
      cell: (client) => <NoShows count={client.noShows} />,
      numeric: true,
    },
    {
      key: 'lastVisit',
      header: t('clients:columns.lastVisit'),
      cell: (client) => (client.lastVisitAt ? dates.day(client.lastVisitAt) : none),
    },
    {
      key: 'nextVisit',
      header: t('clients:columns.nextVisit'),
      cell: (client) =>
        client.nextVisitAt ? (
          <span className={styles.next}>{dates.dayTime(client.nextVisitAt)}</span>
        ) : (
          none
        ),
    },
  ];
  return (
    <DataTable
      caption={t('clients:tableCaption')}
      columns={columns}
      rows={rows}
      rowKey={(client) => client.id}
      onRowClick={(client) => {
        onOpen(client.id);
      }}
    />
  );
}

/** Phones: one tappable row per client with what matters at the front desk. */
export function ClientsList({ rows, timeZone, onOpen }: ClientsViewProps) {
  const { t } = useTranslation();
  const dates = useClientDates(timeZone);
  return (
    <ListGroup>
      {rows.map((client) => (
        <ListItem
          key={client.id}
          leading={<Avatar name={client.displayName} />}
          title={client.displayName}
          description={
            <>
              {client.phone ? (
                <span className={styles.line}>{formatPhone(client.phone)}</span>
              ) : null}
              <span className={styles.line}>
                {client.nextVisitAt
                  ? t('clients:nextVisit', { when: dates.dayTime(client.nextVisitAt) })
                  : t('clients:visits', { count: client.visits })}
              </span>
              <TagBadges tags={client.tags} />
            </>
          }
          trailing={
            client.noShows > 0 ? (
              <Badge tone="danger">{t('clients:noShows', { count: client.noShows })}</Badge>
            ) : undefined
          }
          onClick={() => {
            onOpen(client.id);
          }}
        />
      ))}
    </ListGroup>
  );
}

/** Rows in the shape of clients while the list loads. */
export function ClientsSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton shape="circle" width="var(--size-avatar-md)" height="var(--size-avatar-md)" />
          <div className={styles.skeletonText}>
            <Skeleton shape="text" width="40%" />
            <Skeleton shape="text" width="25%" />
          </div>
        </div>
      ))}
    </div>
  );
}

import { useFormat } from '@mestechko/booking-ui';
import type { ClientCard, ClientPass, Membership } from '@mestechko/contracts/client';
import { MINOR_PER_POINT } from '@mestechko/domain';
import { Badge, ListGroup, ListItem } from '@mestechko/ui';
import { clsx } from 'clsx';
import { Coins, Pencil, Plus, Ticket } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canOpen } from '../../../platform/session/active-business';
import { useClientDates } from '../client-dates';
import { LedgerList, useLedgerFormat } from './ledger-list';
import { PointsDialog } from './points-dialog';
import { SellPassDialog } from './sell-pass-dialog';
import styles from './loyalty.module.css';

/** States of a pass a client holds, in the order the card lists them. */
const passStates = ['active', 'used', 'expired'] as const;
type PassState = (typeof passStates)[number];

function passStateOf(pass: ClientPass, today: string): PassState {
  if (pass.visitsLeft <= 0) {
    return 'used';
  }
  return pass.validUntil < today ? 'expired' : 'active';
}

function PassRow({
  pass,
  state,
  timeZone,
}: {
  readonly pass: ClientPass;
  readonly state: PassState;
  readonly timeZone: string;
}) {
  const { t } = useTranslation();
  const dates = useClientDates(timeZone);
  const inactive = state !== 'active';
  return (
    <ListItem
      leading={<Ticket aria-hidden="true" className={clsx(inactive && styles.dim)} />}
      title={
        <span className={clsx(styles.passTitle, inactive && styles.dim)}>
          {pass.name}
          {inactive ? <Badge>{t(`clients:loyalty.passStates.${state}`)}</Badge> : null}
        </span>
      }
      description={
        <span className={clsx(inactive && styles.dim)}>
          <span className={styles.line}>
            {t('clients:loyalty.visitsLeft', { left: pass.visitsLeft, total: pass.visits })}
            {' · '}
            {t('clients:loyalty.validUntil', { date: dates.date(pass.validUntil) })}
          </span>
          {pass.serviceNames.length > 0 ? (
            <span className={styles.line}>{pass.serviceNames.join(', ')}</span>
          ) : null}
        </span>
      }
    />
  );
}

/**
 * Points and passes of the client with the history behind them. Selling passes and
 * changing points take the loyalty permission; the balances show to everyone.
 */
export function LoyaltyPanel({
  membership,
  card,
  timeZone,
}: {
  readonly membership: Membership;
  readonly card: ClientCard;
  readonly timeZone: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const dates = useClientDates(timeZone);
  const ledger = useLedgerFormat();
  const canManage = canOpen(membership, 'loyalty');
  const [pointsOpen, setPointsOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  // Every opening starts a fresh dialog with its own idempotency key.
  const [session, setSession] = useState(0);
  const { loyalty, client } = card;
  const passes = loyalty.passes
    .map((pass) => ({ pass, state: passStateOf(pass, dates.today) }))
    .sort((left, right) => passStates.indexOf(left.state) - passStates.indexOf(right.state));
  const action = (text: string) => <span className={styles.action}>{text}</span>;

  return (
    <div className={styles.stack}>
      <ListGroup title={t('clients:loyalty.points')}>
        <ListItem
          leading={<Coins aria-hidden="true" className={styles.balanceIcon} />}
          title={<span className={styles.balance}>{ledger.points(loyalty.points)}</span>}
          description={t('clients:loyalty.pointRate', {
            money: format.money({
              amountMinor: MINOR_PER_POINT,
              currency: membership.business.currency,
            }),
          })}
        />
        {canManage ? (
          <ListItem
            leading={<Pencil aria-hidden="true" className={styles.actionIcon} />}
            title={action(t('clients:loyalty.adjust'))}
            onClick={() => {
              setSession((value) => value + 1);
              setPointsOpen(true);
            }}
          />
        ) : null}
      </ListGroup>
      <ListGroup title={t('clients:loyalty.passes')}>
        {passes.length === 0 ? (
          <ListItem title={<span className={styles.empty}>{t('clients:loyalty.noPasses')}</span>} />
        ) : null}
        {passes.map(({ pass, state }) => (
          <PassRow key={pass.id} pass={pass} state={state} timeZone={timeZone} />
        ))}
        {canManage ? (
          <ListItem
            leading={<Plus aria-hidden="true" className={styles.actionIcon} />}
            title={action(t('clients:loyalty.sell'))}
            onClick={() => {
              setSession((value) => value + 1);
              setSellOpen(true);
            }}
          />
        ) : null}
      </ListGroup>
      <LedgerList entries={loyalty.ledger} timeZone={timeZone} />
      {canManage ? (
        <>
          <PointsDialog
            key={`points-${String(session)}`}
            businessId={membership.business.id}
            clientId={client.id}
            balance={loyalty.points}
            open={pointsOpen}
            onOpenChange={setPointsOpen}
          />
          <SellPassDialog
            key={`pass-${String(session)}`}
            businessId={membership.business.id}
            clientId={client.id}
            timeZone={timeZone}
            open={sellOpen}
            onOpenChange={setSellOpen}
          />
        </>
      ) : null}
    </div>
  );
}

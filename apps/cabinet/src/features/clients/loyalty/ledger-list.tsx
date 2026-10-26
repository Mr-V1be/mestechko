import { useFormat } from '@slotwise/booking-ui';
import type { LedgerEntry } from '@slotwise/contracts/client';
import { currencies, type CurrencyCode, type LedgerAccount } from '@slotwise/domain';
import { Button, ListGroup, ListItem } from '@slotwise/ui';
import { clsx } from 'clsx';
import { Banknote, Coins, Ticket, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClientDates } from '../client-dates';
import styles from './loyalty.module.css';

/** Entries shown before «show all». */
const LEDGER_PREVIEW = 5;
/** Typographic signs: a minus, not a hyphen. */
const signs = { credit: '+', debit: '−', none: '' } as const;

function signOf(amount: number): string {
  return amount > 0 ? signs.credit : amount < 0 ? signs.debit : signs.none;
}

function isCurrency(code: string | null): code is CurrencyCode {
  return code !== null && Object.hasOwn(currencies, code);
}

/** Every account has an icon; a new account is one entry. */
const accountIcons: Readonly<Record<LedgerAccount, LucideIcon>> = {
  points: Coins,
  pass: Ticket,
  money: Banknote,
};

/** Amounts by account: points are whole points, pass entries are visits, money is minor units. */
export function useLedgerFormat() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const number = new Intl.NumberFormat(i18n.language);
  const counted = (key: string, amount: number, signed: boolean) =>
    t(key, {
      count: Math.abs(amount),
      value: number.format(Math.abs(amount)),
      sign: signed ? signOf(amount) : signs.none,
    });
  const amounts: Readonly<Record<LedgerAccount, (entry: LedgerEntry) => string>> = {
    points: (entry) => counted('clients:ledger.points', entry.amount, true),
    pass: (entry) => counted('clients:ledger.visits', entry.amount, true),
    money: (entry) =>
      t('clients:ledger.money', {
        sign: signOf(entry.amount),
        value: isCurrency(entry.currency)
          ? format.money({ amountMinor: Math.abs(entry.amount), currency: entry.currency })
          : number.format(Math.abs(entry.amount)),
      }),
  };
  return {
    /** A balance of points, e.g. «505 баллов». */
    points: (value: number) => counted('clients:ledger.points', value, false),
    /** A signed amount of an entry, e.g. «+75 баллов», «−1 визит», «+1 500 ₽». */
    amount: (entry: LedgerEntry) => amounts[entry.account](entry),
  };
}

/** Recent points, pass and payment entries, newest first, with their reasons. */
export function LedgerList({
  entries,
  timeZone,
}: {
  readonly entries: readonly LedgerEntry[];
  readonly timeZone: string;
}) {
  const { t } = useTranslation();
  const dates = useClientDates(timeZone);
  const ledger = useLedgerFormat();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, LEDGER_PREVIEW);
  return (
    <div className={styles.stack}>
      <ListGroup title={t('clients:loyalty.ledger')}>
        {shown.length === 0 ? (
          <ListItem title={<span className={styles.empty}>{t('clients:loyalty.noLedger')}</span>} />
        ) : null}
        {shown.map((entry) => {
          const Icon = accountIcons[entry.account];
          return (
            <ListItem
              key={entry.id}
              leading={<Icon aria-hidden="true" className={styles.entryIcon} />}
              title={t(`clients:ledger.reasons.${entry.reason}`)}
              description={[entry.passName, entry.note, dates.dayTime(entry.createdAt)]
                .filter(Boolean)
                .join(' · ')}
              meta={
                <span className={clsx(entry.amount > 0 && styles.credit)}>
                  {ledger.amount(entry)}
                </span>
              }
            />
          );
        })}
      </ListGroup>
      {entries.length > LEDGER_PREVIEW ? (
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
            : t('clients:card.showAll', { count: entries.length })}
        </Button>
      ) : null}
    </div>
  );
}

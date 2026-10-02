import { sql } from 'kysely';
import { ledgerReasons, type LedgerAccount } from '@mestechko/domain';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { isUniqueViolation } from '../../../platform/db/pg-errors.js';
import {
  DuplicateLedgerRequestError,
  type DailyMoney,
  type LedgerEntryView,
  type LedgerStore,
  type MoneyWindow,
  type NewLedgerEntry,
  type SettlementEntryView,
} from '../application/ports.js';

const IDEMPOTENCY_CONSTRAINT = 'ledger_entries_idempotency_key';

export class KyselyLedgerStore implements LedgerStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async lockClient(clientId: string): Promise<void> {
    // One lock per client and transaction: concurrent debits see each other's entries.
    await sql`select pg_advisory_xact_lock(hashtextextended(${`ledger:${clientId}`}, 0))`.execute(
      this.unitOfWork.tenant(),
    );
  }

  async balance(clientId: string, account: LedgerAccount, passId?: string): Promise<number> {
    let query = this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries')
      .select((eb) => eb.fn.coalesce(eb.fn.sum<string>('amount'), sql<string>`0`).as('total'))
      .where('clientId', '=', clientId)
      .where('account', '=', account);
    if (passId !== undefined) {
      query = query.where('passId', '=', passId);
    }
    const row = await query.executeTakeFirstOrThrow();
    return Number(row.total);
  }

  async passBalances(passIds: readonly string[]): Promise<Map<string, number>> {
    if (passIds.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries')
      .select((eb) => ['passId', eb.fn.sum<string>('amount').as('total')])
      .where('account', '=', 'pass')
      .where('passId', 'in', passIds)
      .groupBy('passId')
      .execute();
    return new Map(rows.flatMap((row) => (row.passId ? [[row.passId, Number(row.total)]] : [])));
  }

  async append(entries: readonly NewLedgerEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    await sql`savepoint ledger_append`.execute(db);
    try {
      await db
        .insertInto('ledgerEntries')
        .values(
          entries.map((entry) => ({
            id: entry.id,
            businessId,
            clientId: entry.clientId,
            account: ledgerReasons[entry.reason].account,
            reason: entry.reason,
            amount: entry.amount,
            currency: entry.currency,
            passId: entry.passId,
            bookingId: entry.bookingId,
            paymentId: entry.paymentId,
            note: entry.note,
            actorUserId: entry.actorUserId,
            idempotencyKey: entry.idempotencyKey,
            createdAt: entry.createdAt,
          })),
        )
        .execute();
      await sql`release savepoint ledger_append`.execute(db);
    } catch (error) {
      await sql`rollback to savepoint ledger_append`.execute(db);
      if (isUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
        throw new DuplicateLedgerRequestError();
      }
      throw error;
    }
  }

  async listForClient(clientId: string, limit: number): Promise<LedgerEntryView[]> {
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries as e')
      .leftJoin('clientPasses as p', 'p.id', 'e.passId')
      .select([
        'e.id',
        'e.account',
        'e.reason',
        'e.amount',
        'e.currency',
        'p.name as passName',
        'e.bookingId',
        'e.note',
        'e.createdAt',
      ])
      .where('e.clientId', '=', clientId)
      .orderBy('e.createdAt', 'desc')
      .orderBy('e.id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      ...row,
      currency: row.currency === null ? null : currencyCode(row.currency),
    }));
  }

  async settlementOf(bookingId: string): Promise<SettlementEntryView[]> {
    return this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries as e')
      .leftJoin('clientPasses as p', 'p.id', 'e.passId')
      .select(['e.reason', 'e.amount', 'p.name as passName'])
      .where('e.bookingId', '=', bookingId)
      .where('e.paymentId', 'is', null)
      .orderBy('e.createdAt')
      .orderBy('e.id')
      .execute();
  }

  async pointsBalances(clientIds: readonly string[]): Promise<Map<string, number>> {
    if (clientIds.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries')
      .select((eb) => ['clientId', eb.fn.sum<string>('amount').as('total')])
      .where('account', '=', 'points')
      .where('clientId', 'in', clientIds)
      .groupBy('clientId')
      .execute();
    return new Map(rows.map((row) => [row.clientId, Number(row.total)]));
  }

  async dailyMoney(window: MoneyWindow): Promise<DailyMoney[]> {
    const day = sql<string>`(created_at at time zone ${window.timeZone})::date::text`;
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('ledgerEntries')
      .select((eb) => [day.as('date'), eb.fn.sum<string>('amount').as('total')])
      .where('account', '=', 'money')
      .where('createdAt', '>=', window.start)
      .where('createdAt', '<', window.end)
      .groupBy(day)
      .execute();
    return rows.map((row) => ({ date: row.date, amountMinor: Number(row.total) }));
  }
}

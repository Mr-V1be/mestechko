import { AsyncLocalStorage } from 'node:async_hooks';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { UnitOfWork, UnitOfWorkOptions } from '../../shared/application/unit-of-work.js';
import type { Database } from './database.js';

interface TenantTransaction {
  readonly businessId: string;
  readonly transaction: Transaction<Database>;
}

export class TenantContextMissingError extends Error {
  constructor() {
    super('Tenant-scoped data accessed outside of a tenant transaction');
    this.name = 'TenantContextMissingError';
  }
}

/**
 * Binds a transaction to the tenant through `app.business_id`, which row-level
 * security policies read. Repositories obtain the transaction from here, so a
 * tenant-scoped query outside of `inTenant` fails instead of leaking data.
 */
export class KyselyUnitOfWork implements UnitOfWork {
  private readonly storage = new AsyncLocalStorage<TenantTransaction>();
  private readonly db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.db = db;
  }

  async inTenant<T>(
    businessId: string,
    work: () => Promise<T>,
    options: UnitOfWorkOptions = {},
  ): Promise<T> {
    const current = this.storage.getStore();
    if (current) {
      if (current.businessId !== businessId) {
        throw new Error('A tenant transaction cannot be nested inside another tenant');
      }
      return work();
    }
    const builder = options.readOnly
      ? this.db.transaction().setAccessMode('read only')
      : this.db.transaction();
    return builder.execute(async (transaction) => {
      await sql`select set_config('app.business_id', ${businessId}, true)`.execute(transaction);
      return this.storage.run({ businessId, transaction }, work);
    });
  }

  /** Transaction of the current tenant; throws outside of `inTenant`. */
  tenant(): Transaction<Database> {
    const current = this.storage.getStore();
    if (!current) {
      throw new TenantContextMissingError();
    }
    return current.transaction;
  }

  currentBusinessId(): string {
    const current = this.storage.getStore();
    if (!current) {
      throw new TenantContextMissingError();
    }
    return current.businessId;
  }

  /** Executor for platform tables: joins the current transaction when there is one. */
  platform(): Kysely<Database> {
    return this.storage.getStore()?.transaction ?? this.db;
  }
}

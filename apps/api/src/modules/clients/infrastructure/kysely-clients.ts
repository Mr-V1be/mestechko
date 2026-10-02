import type { MessengerChannel } from '@mestechko/domain';
import { sql } from 'kysely';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  ClientContact,
  ClientDirectory,
  ClientRecord,
  CustomerIdentities,
} from '../application/ports.js';

export class KyselyCustomerIdentities implements CustomerIdentities {
  constructor(
    private readonly unitOfWork: KyselyUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async find(channel: MessengerChannel, externalId: string): Promise<string | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('customerIdentities')
      .select('customerId')
      .where('channel', '=', channel)
      .where('externalId', '=', externalId)
      .executeTakeFirst();
    return row?.customerId ?? null;
  }

  /**
   * A transaction-scoped advisory lock on the identity serializes first contacts, so
   * two concurrent requests never create two customers for one person.
   */
  async ensure(channel: MessengerChannel, externalId: string, now: Date): Promise<string> {
    const db = this.unitOfWork.platform();
    await sql`select pg_advisory_xact_lock(hashtextextended(${`${channel}:${externalId}`}, 0))`.execute(
      db,
    );
    const existing = await this.find(channel, externalId);
    if (existing) {
      return existing;
    }
    const customerId = this.ids.next();
    await db.insertInto('customers').values({ id: customerId, createdAt: now }).execute();
    await db
      .insertInto('customerIdentities')
      .values({ channel, externalId, customerId, createdAt: now })
      .execute();
    return customerId;
  }
}

export class KyselyClientDirectory implements ClientDirectory {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async findByCustomer(customerId: string): Promise<ClientRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('clients')
      .select(['id', 'customerId', 'displayName', 'phone'])
      .where('customerId', '=', customerId)
      .executeTakeFirst();
    return row ?? null;
  }

  async upsertForCustomer(
    customerId: string,
    contact: ClientContact,
    ids: { readonly newId: string; readonly now: Date },
  ): Promise<ClientRecord> {
    const db = this.unitOfWork.tenant();
    return db
      .insertInto('clients')
      .values({
        id: ids.newId,
        businessId: this.unitOfWork.currentBusinessId(),
        customerId,
        displayName: contact.displayName,
        phone: contact.phone,
        createdAt: ids.now,
        updatedAt: ids.now,
      })
      .onConflict((conflict) =>
        conflict.columns(['businessId', 'customerId']).doUpdateSet({
          displayName: (eb) => eb.ref('excluded.displayName'),
          phone: (eb) => eb.ref('excluded.phone'),
          updatedAt: (eb) => eb.ref('excluded.updatedAt'),
        }),
      )
      .returning(['id', 'customerId', 'displayName', 'phone'])
      .executeTakeFirstOrThrow();
  }
}

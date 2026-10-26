import { isLocale, type Locale, type MessengerChannel } from '@slotwise/domain';
import { sql } from 'kysely';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  ClientContact,
  ClientDirectory,
  ClientRecord,
  CustomerIdentities,
  MessengerClient,
  NewClient,
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

  async chosenLocale(channel: MessengerChannel, externalId: string): Promise<Locale | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('customerIdentities')
      .innerJoin('customers', 'customers.id', 'customerIdentities.customerId')
      .select('customers.locale')
      .where('customerIdentities.channel', '=', channel)
      .where('customerIdentities.externalId', '=', externalId)
      .executeTakeFirst();
    // A language the platform no longer speaks counts as no choice.
    return isLocale(row?.locale) ? row.locale : null;
  }

  async chooseLocale(
    channel: MessengerChannel,
    externalId: string,
    locale: Locale,
    now: Date,
  ): Promise<void> {
    await this.unitOfWork.inPlatform(async () => {
      const customerId = await this.ensure(channel, externalId, now);
      await this.unitOfWork
        .platform()
        .updateTable('customers')
        .set({ locale })
        .where('id', '=', customerId)
        .execute();
    });
  }

  async recordLanguage(
    channel: MessengerChannel,
    externalId: string,
    languageTag: string,
  ): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('customerIdentities')
      .set({ languageTag })
      .where('channel', '=', channel)
      .where('externalId', '=', externalId)
      .where((eb) => eb('languageTag', 'is distinct from', languageTag))
      .execute();
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

  async findById(clientId: string): Promise<ClientRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('clients')
      .select(['id', 'customerId', 'displayName', 'phone'])
      .where('id', '=', clientId)
      .executeTakeFirst();
    return row ?? null;
  }

  async findByPhone(phone: string): Promise<ClientRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('clients')
      .select(['id', 'customerId', 'displayName', 'phone'])
      .where('phone', '=', phone)
      .orderBy('updatedAt', 'desc')
      .executeTakeFirst();
    return row ?? null;
  }

  create(client: NewClient): Promise<ClientRecord> {
    return this.unitOfWork
      .tenant()
      .insertInto('clients')
      .values({
        id: client.id,
        businessId: this.unitOfWork.currentBusinessId(),
        customerId: null,
        displayName: client.displayName,
        phone: client.phone,
        email: client.email,
        tags: [...client.tags],
        createdAt: client.now,
        updatedAt: client.now,
      })
      .returning(['id', 'customerId', 'displayName', 'phone'])
      .executeTakeFirstOrThrow();
  }

  async listByChannel(channel: MessengerChannel): Promise<MessengerClient[]> {
    return this.unitOfWork
      .tenant()
      .selectFrom('clients as c')
      .innerJoin('customerIdentities as i', 'i.customerId', 'c.customerId')
      .select(['c.id as clientId', 'c.displayName', 'i.externalId'])
      .where('i.channel', '=', channel)
      .orderBy('c.displayName')
      .execute();
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
        tags: [],
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

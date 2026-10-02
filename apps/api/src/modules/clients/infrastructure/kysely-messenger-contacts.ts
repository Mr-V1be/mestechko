import type { MessengerChannel } from '@mestechko/domain';
import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  CustomerIdentities,
  MessagingAddress,
  MessengerContacts,
} from '../application/ports.js';

export class KyselyMessengerContacts implements MessengerContacts {
  constructor(
    private readonly unitOfWork: KyselyUnitOfWork,
    private readonly identities: CustomerIdentities,
  ) {}

  async allow(
    channel: MessengerChannel,
    externalId: string,
    chatId: string,
    now: Date,
  ): Promise<string> {
    return this.unitOfWork.inPlatform(async () => {
      const customerId = await this.identities.ensure(channel, externalId, now);
      await this.unitOfWork
        .platform()
        .updateTable('customerIdentities')
        .set((eb) => ({
          chatId,
          messagingAllowedAt: eb.fn.coalesce('messagingAllowedAt', eb.val(now)),
        }))
        .where('channel', '=', channel)
        .where('externalId', '=', externalId)
        .execute();
      return customerId;
    });
  }

  async revoke(channel: MessengerChannel, externalId: string): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('customerIdentities')
      .set({ messagingAllowedAt: null })
      .where('channel', '=', channel)
      .where('externalId', '=', externalId)
      .execute();
  }

  async isAllowed(channel: MessengerChannel, externalId: string): Promise<boolean> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('customerIdentities')
      .select('messagingAllowedAt')
      .where('channel', '=', channel)
      .where('externalId', '=', externalId)
      .executeTakeFirst();
    return Boolean(row?.messagingAllowedAt);
  }

  async addressOf(customerId: string, channel: MessengerChannel): Promise<MessagingAddress | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('customerIdentities')
      .select(['externalId', 'chatId'])
      .where('customerId', '=', customerId)
      .where('channel', '=', channel)
      .where('messagingAllowedAt', 'is not', null)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
    return row?.chatId ? { externalId: row.externalId, chatId: row.chatId } : null;
  }

  async preferredChannel(customerId: string): Promise<MessengerChannel | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('customerIdentities')
      .select('channel')
      .where('customerId', '=', customerId)
      .where('messagingAllowedAt', 'is not', null)
      .orderBy('messagingAllowedAt', 'desc')
      .executeTakeFirst();
    return row?.channel ?? null;
  }

  async businessesOf(customerId: string): Promise<string[]> {
    const result = await sql<{ id: string }>`
      select customer_business_ids as id from customer_business_ids(${customerId})
    `.execute(this.unitOfWork.platform());
    return result.rows.map((row) => row.id);
  }
}

import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  EmulatedMessage,
  EmulatedUpdate,
  EmulatedUser,
  EmulatorStore,
} from '../application/ports.js';

const NOTICES_KEPT = 20;

interface MessageRow {
  mid: string;
  userId: string;
  fromBot: boolean;
  text: string | null;
  format: string | null;
  attachments: string;
  sentAt: Date;
  editedAt: Date | null;
}

function toMessage(row: MessageRow): EmulatedMessage {
  return {
    mid: row.mid,
    userId: row.userId,
    fromBot: row.fromBot,
    text: row.text,
    format: row.format === 'html' || row.format === 'markdown' ? row.format : null,
    attachments: JSON.parse(row.attachments) as unknown[],
    sentAt: row.sentAt,
    editedAt: row.editedAt,
  };
}

export class KyselyEmulatorStore implements EmulatorStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  private get db() {
    return this.unitOfWork.platform();
  }

  async ensureUser(userId: string, firstName: string, now: Date): Promise<EmulatedUser> {
    await this.db
      .insertInto('maxEmulatorUsers')
      .values({ userId, firstName, lastName: null, botStartedAt: null, createdAt: now })
      .onConflict((conflict) => conflict.column('userId').doNothing())
      .execute();
    const user = await this.findUser(userId);
    if (!user) {
      throw new Error(`Emulated user ${userId} vanished`);
    }
    return user;
  }

  async findUser(userId: string): Promise<EmulatedUser | null> {
    const row = await this.db
      .selectFrom('maxEmulatorUsers')
      .select(['userId', 'firstName', 'botStartedAt'])
      .where('userId', '=', userId)
      .executeTakeFirst();
    return row
      ? { userId: row.userId, firstName: row.firstName, startedAt: row.botStartedAt }
      : null;
  }

  async markStarted(userId: string, now: Date): Promise<void> {
    await this.db
      .updateTable('maxEmulatorUsers')
      .set((eb) => ({ botStartedAt: eb.fn.coalesce('botStartedAt', eb.val(now)) }))
      .where('userId', '=', userId)
      .execute();
  }

  async addMessage(message: EmulatedMessage): Promise<void> {
    await this.db
      .insertInto('maxEmulatorMessages')
      .values({
        mid: message.mid,
        userId: message.userId,
        fromBot: message.fromBot,
        text: message.text,
        format: message.format,
        attachments: JSON.stringify(message.attachments),
        sentAt: message.sentAt,
        editedAt: message.editedAt,
      })
      .execute();
  }

  async editMessage(
    mid: string,
    change: Pick<EmulatedMessage, 'text' | 'format' | 'attachments'>,
    now: Date,
  ): Promise<boolean> {
    const result = await this.db
      .updateTable('maxEmulatorMessages')
      .set({
        text: change.text,
        format: change.format,
        attachments: JSON.stringify(change.attachments),
        editedAt: now,
      })
      .where('mid', '=', mid)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async findMessage(mid: string): Promise<EmulatedMessage | null> {
    const row = await this.messages().where('mid', '=', mid).executeTakeFirst();
    return row ? toMessage(row) : null;
  }

  async dialog(userId: string): Promise<EmulatedMessage[]> {
    const rows = await this.messages().where('userId', '=', userId).orderBy('seq').execute();
    return rows.map(toMessage);
  }

  async lastMessages(userIds: readonly string[]): Promise<EmulatedMessage[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.messages()
      .distinctOn('userId')
      .where('userId', 'in', userIds)
      .orderBy('userId')
      .orderBy('seq', 'desc')
      .execute();
    return rows.map(toMessage);
  }

  async addUpdate(update: Readonly<Record<string, unknown>>, now: Date): Promise<number> {
    const row = await this.db
      .insertInto('maxEmulatorUpdates')
      .values({ update: JSON.stringify(update), createdAt: now })
      .returning('marker')
      .executeTakeFirstOrThrow();
    return Number(row.marker);
  }

  async updatesFrom(marker: number, limit: number): Promise<EmulatedUpdate[]> {
    // Read as text: the camel-casing of result keys must not touch MAX's snake_case JSON.
    const rows = await this.db
      .selectFrom('maxEmulatorUpdates')
      .select(['marker', sql<string>`update::text`.as('json')])
      .where('marker', '>=', String(marker))
      .orderBy('marker')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      marker: Number(row.marker),
      update: JSON.parse(row.json) as Record<string, unknown>,
    }));
  }

  async nextMarker(): Promise<number> {
    const row = await this.db
      .selectFrom('maxEmulatorUpdates')
      .select((eb) => eb.fn.max('marker').as('last'))
      .executeTakeFirst();
    return Number(row?.last ?? 0) + 1;
  }

  async callbackMessage(callbackId: string): Promise<{ mid: string; userId: string } | null> {
    const row = await this.db
      .selectFrom('maxEmulatorUpdates')
      .select([
        sql<string>`update -> 'message' -> 'body' ->> 'mid'`.as('mid'),
        sql<string>`update -> 'callback' -> 'user' ->> 'user_id'`.as('userId'),
      ])
      .where(sql<string>`update -> 'callback' ->> 'callback_id'`, '=', callbackId)
      .executeTakeFirst();
    return row ? { mid: row.mid, userId: row.userId } : null;
  }

  async addNotice(userId: string, text: string, now: Date): Promise<void> {
    await this.db
      .insertInto('maxEmulatorNotices')
      .values({ userId, text, createdAt: now })
      .execute();
  }

  async notices(userId: string): Promise<{ text: string; shownAt: Date }[]> {
    const rows = await this.db
      .selectFrom('maxEmulatorNotices')
      .select(['text', 'createdAt'])
      .where('userId', '=', userId)
      .orderBy('id', 'desc')
      .limit(NOTICES_KEPT)
      .execute();
    return rows.reverse().map((row) => ({ text: row.text, shownAt: row.createdAt }));
  }

  private messages() {
    return this.db
      .selectFrom('maxEmulatorMessages')
      .select([
        'mid',
        'userId',
        'fromBot',
        'text',
        'format',
        sql<string>`attachments::text`.as('attachments'),
        'sentAt',
        'editedAt',
      ]);
  }
}

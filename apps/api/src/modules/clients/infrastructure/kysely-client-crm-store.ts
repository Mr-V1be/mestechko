import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { decodeKeyset, encodeKeyset } from '../../../platform/db/keyset-cursor.js';
import type {
  ClientCrmStore,
  ClientFields,
  ClientNoteRecord,
  ClientPage,
  ClientProfile,
  ClientSearch,
} from '../application/crm-ports.js';

const LIKE_SPECIALS = /[\\%_]/g;
const MIN_PHONE_DIGITS = 3;

const containsPattern = (search: string) =>
  `%${search.replace(LIKE_SPECIALS, (match) => `\\${match}`)}%`;

export class KyselyClientCrmStore implements ClientCrmStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async search(
    query: ClientSearch,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<ClientPage> {
    const byName = query.sort === 'name';
    const keyset = decodeKeyset(page.cursor, 2);
    let rows = this.profiles().limit(page.limit + 1);
    rows = byName
      ? rows.orderBy(sql`lower(c.display_name)`).orderBy('c.id')
      : rows.orderBy('c.createdAt', 'desc').orderBy('c.id', 'desc');
    if (query.search) {
      const pattern = containsPattern(query.search);
      const digits = query.search.replace(/\D/g, '');
      rows = rows.where((eb) =>
        eb.or([
          eb('c.displayName', 'ilike', pattern),
          eb('c.email', 'ilike', pattern),
          ...(digits.length >= MIN_PHONE_DIGITS
            ? [eb('c.phone', 'like', containsPattern(digits))]
            : []),
        ]),
      );
    }
    if (query.tag) {
      rows = rows.where(sql<boolean>`${query.tag} = any(c.tags)`);
    }
    if (keyset) {
      const [key = '', id = ''] = keyset;
      rows = byName
        ? rows.where(sql<boolean>`(lower(c.display_name), c.id) > (${key}, ${id}::uuid)`)
        : rows.where(sql<boolean>`(c.created_at, c.id) < (${new Date(key)}, ${id}::uuid)`);
    }
    const found = await rows.execute();
    const visible = found.slice(0, page.limit);
    const last = visible.at(-1);
    return {
      items: visible,
      nextCursor:
        found.length > page.limit && last
          ? encodeKeyset([
              byName ? last.displayName.toLowerCase() : last.createdAt.toISOString(),
              last.id,
            ])
          : null,
    };
  }

  async find(clientId: string): Promise<ClientProfile | null> {
    const row = await this.profiles().where('c.id', '=', clientId).executeTakeFirst();
    return row ?? null;
  }

  async create(id: string, fields: ClientFields, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .insertInto('clients')
      .values({
        id,
        businessId: this.unitOfWork.currentBusinessId(),
        customerId: null,
        ...fields,
        tags: [...fields.tags],
        createdAt: now,
        updatedAt: now,
      })
      .execute();
  }

  async update(clientId: string, changes: Partial<ClientFields>, now: Date): Promise<void> {
    const { tags, ...rest } = changes;
    await this.unitOfWork
      .tenant()
      .updateTable('clients')
      .set({ ...rest, ...(tags ? { tags: [...tags] } : {}), updatedAt: now })
      .where('id', '=', clientId)
      .execute();
  }

  async tagCounts(): Promise<{ tag: string; clients: number }[]> {
    const result = await sql<{ tag: string; clients: string }>`
      select tag, count(*) as clients from clients, unnest(tags) as tag
      group by tag order by count(*) desc, tag
    `.execute(this.unitOfWork.tenant());
    return result.rows.map((row) => ({ tag: row.tag, clients: Number(row.clients) }));
  }

  notes(clientId: string, limit: number): Promise<ClientNoteRecord[]> {
    return this.unitOfWork
      .tenant()
      .selectFrom('clientNotes as n')
      .leftJoin('users as u', 'u.id', 'n.authorUserId')
      .select(['n.id', 'n.body', 'u.displayName as authorName', 'n.createdAt'])
      .where('n.clientId', '=', clientId)
      .orderBy('n.createdAt', 'desc')
      .orderBy('n.id', 'desc')
      .limit(limit)
      .execute();
  }

  async addNote(note: {
    readonly id: string;
    readonly clientId: string;
    readonly authorUserId: string;
    readonly body: string;
    readonly now: Date;
  }): Promise<void> {
    await this.unitOfWork
      .tenant()
      .insertInto('clientNotes')
      .values({
        id: note.id,
        businessId: this.unitOfWork.currentBusinessId(),
        clientId: note.clientId,
        authorUserId: note.authorUserId,
        body: note.body,
        createdAt: note.now,
        updatedAt: note.now,
      })
      .execute();
  }

  async deleteNote(clientId: string, noteId: string): Promise<boolean> {
    const result = await this.unitOfWork
      .tenant()
      .deleteFrom('clientNotes')
      .where('id', '=', noteId)
      .where('clientId', '=', clientId)
      .executeTakeFirst();
    return result.numDeletedRows === 1n;
  }

  batchAfter(afterId: string | null, limit: number): Promise<ClientProfile[]> {
    let query = this.profiles().orderBy('c.id').limit(limit);
    if (afterId) {
      query = query.where('c.id', '>', afterId);
    }
    return query.execute();
  }

  async idsByPhone(phones: readonly string[]): Promise<Map<string, string>> {
    if (phones.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('clients')
      .select(['id', 'phone'])
      .where('phone', 'in', phones)
      .orderBy('updatedAt')
      .execute();
    // The most recently updated card wins when several share a phone.
    return new Map(rows.flatMap((row) => (row.phone ? [[row.phone, row.id]] : [])));
  }

  private profiles() {
    return this.unitOfWork
      .tenant()
      .selectFrom('clients as c')
      .select([
        'c.id',
        'c.customerId',
        'c.displayName',
        'c.phone',
        'c.email',
        'c.tags',
        'c.createdAt',
      ])
      .select((eb) =>
        eb
          .selectFrom('customerIdentities as i')
          .select('i.channel')
          .whereRef('i.customerId', '=', 'c.customerId')
          .where('i.messagingAllowedAt', 'is not', null)
          .orderBy('i.messagingAllowedAt', 'desc')
          .limit(1)
          .as('messenger'),
      );
  }
}

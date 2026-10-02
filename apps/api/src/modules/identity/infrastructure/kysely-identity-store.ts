import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  SessionStore,
  StoredSession,
  UserAccount,
  UserAccounts,
} from '../application/ports.js';

/** Users and sessions are platform tables: one account may work for several businesses. */
export class KyselyIdentityStore implements UserAccounts, SessionStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('users')
      .select(['id', 'email', 'displayName', 'passwordHash'])
      .where(sql<string>`lower(email)`, '=', email.toLowerCase())
      .executeTakeFirst();
    return row ?? null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('users')
      .select(['id', 'email', 'displayName', 'passwordHash'])
      .where('id', '=', id)
      .executeTakeFirst();
    return row ?? null;
  }

  async create(
    session: StoredSession & { readonly tokenHash: Buffer; readonly createdAt: Date },
  ): Promise<void> {
    await this.unitOfWork.platform().insertInto('userSessions').values(session).execute();
  }

  async findActive(tokenHash: Buffer, now: Date): Promise<StoredSession | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('userSessions')
      .select(['id', 'userId', 'lastSeenAt', 'expiresAt'])
      .where('tokenHash', '=', tokenHash)
      .where('expiresAt', '>', now)
      .executeTakeFirst();
    return row ?? null;
  }

  async touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('userSessions')
      .set({ lastSeenAt, expiresAt })
      .where('id', '=', id)
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.unitOfWork.platform().deleteFrom('userSessions').where('id', '=', id).execute();
  }
}

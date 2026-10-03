import { sql, type Kysely } from 'kysely';

export class UnsafeApplicationRoleError extends Error {
  constructor(role: string) {
    super(
      `The application role "${role}" is a superuser: row-level security would not apply to it. ` +
        'Recreate it as an ordinary role.',
    );
    this.name = 'UnsafeApplicationRoleError';
  }
}

/**
 * Ensures the restricted application role exists and can use every table.
 * The role owns nothing and is not a superuser, so row-level security applies to it.
 *
 * The owner that runs this may be a superuser (a dedicated server) or an ordinary role with
 * CREATEROLE and BYPASSRLS (a PostgreSQL shared with other products). Only a superuser may
 * name the SUPERUSER attribute in ALTER ROLE, so an existing role is checked instead of
 * being altered with NOSUPERUSER.
 */
export async function provisionApplicationRole(
  admin: Kysely<unknown>,
  applicationUrl: string,
): Promise<void> {
  const url = new URL(applicationUrl);
  const role = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.replace(/^\//, '');
  const roleId = sql.id(role);
  const passwordLiteral = sql.lit(password);

  const existing = await sql<{ superuser: boolean }>`
    select rolsuper as superuser from pg_roles where rolname = ${role}
  `.execute(admin);
  const current = existing.rows[0];
  if (current !== undefined) {
    if (current.superuser) {
      throw new UnsafeApplicationRoleError(role);
    }
    await sql`alter role ${roleId} with login nobypassrls password ${passwordLiteral}`.execute(
      admin,
    );
  } else {
    await sql`create role ${roleId} with login nosuperuser nobypassrls password ${passwordLiteral}`.execute(
      admin,
    );
  }
  await sql`grant connect on database ${sql.id(database)} to ${roleId}`.execute(admin);
  await sql`grant usage on schema public to ${roleId}`.execute(admin);
  await sql`grant select, insert, update, delete on all tables in schema public to ${roleId}`.execute(
    admin,
  );
  await sql`grant usage, select on all sequences in schema public to ${roleId}`.execute(admin);
  await sql`alter default privileges in schema public grant select, insert, update, delete on tables to ${roleId}`.execute(
    admin,
  );
  await sql`alter default privileges in schema public grant usage, select on sequences to ${roleId}`.execute(
    admin,
  );
  // Narrow security-definer helpers (e.g. a customer's businesses) are revoked from
  // PUBLIC and granted to the application role only.
  await sql`grant execute on all functions in schema public to ${roleId}`.execute(admin);
  await sql`alter default privileges in schema public grant execute on functions to ${roleId}`.execute(
    admin,
  );
}

import { sql, type Kysely } from 'kysely';

/**
 * Ensures the restricted application role exists and can use every table.
 * The role owns nothing and is not a superuser, so row-level security applies to it.
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

  const existing = await sql<{ exists: boolean }>`
    select exists (select 1 from pg_roles where rolname = ${role}) as exists
  `.execute(admin);
  if (existing.rows[0]?.exists) {
    await sql`alter role ${roleId} with login nosuperuser nobypassrls password ${passwordLiteral}`.execute(
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
}

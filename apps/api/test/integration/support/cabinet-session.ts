import type { RoleId } from '@mestechko/domain';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Kysely } from 'kysely';
import { ScryptPasswordHasher } from '../../../src/modules/identity/infrastructure/crypto-adapters.js';
import type { Database } from '../../../src/platform/db/database.js';
import { UuidV7Generator } from '../../../src/platform/system-clock.js';
import type { TenantFixture } from './tenant-fixture.js';

const ids = new UuidV7Generator();

/** Makes the tenant a demo business, so its people can sign in as demo personas. */
export async function enableDemoSignIn(
  admin: Kysely<Database>,
  tenant: TenantFixture,
): Promise<void> {
  await admin
    .updateTable('businesses')
    .set({ isDemo: true })
    .where('id', '=', tenant.businessId)
    .execute();
}

export async function addMember(
  admin: Kysely<Database>,
  tenant: TenantFixture,
  role: RoleId,
  displayName: string,
  staffId: string | null = null,
): Promise<string> {
  const userId = ids.next();
  await admin
    .insertInto('users')
    .values({
      id: userId,
      email: `${role}-${userId.slice(-8)}@example.test`,
      displayName,
      passwordHash: await new ScryptPasswordHasher().hash('unused password'),
      createdAt: new Date(),
    })
    .execute();
  await admin
    .insertInto('memberships')
    .values({ businessId: tenant.businessId, userId, role, staffId, createdAt: new Date() })
    .execute();
  return userId;
}

/** Cookie headers of a cabinet session of the demo persona holding the role. */
export async function cabinetHeaders(
  app: NestFastifyApplication,
  tenant: TenantFixture,
  role: RoleId,
): Promise<Record<string, string>> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/demo-sessions',
    payload: { businessSlug: tenant.slug, role },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Demo sign-in failed: ${response.body}`);
  }
  const cookie = response.cookies.find((entry) => entry.name === 'mst_session');
  return { cookie: `mst_session=${cookie?.value ?? ''}` };
}

import type { Kysely } from 'kysely';
import { z } from 'zod';
import { createDatabase } from '../platform/db/database.js';

const ADMIN_POOL_SIZE = 4;

const adminEnvironment = z.object({
  DATABASE_ADMIN_URL: z.url(),
  DATABASE_URL: z.url(),
});

export function adminEnvironmentFrom(source: NodeJS.ProcessEnv = process.env) {
  const parsed = adminEnvironment.safeParse(source);
  if (!parsed.success) {
    throw new Error('DATABASE_ADMIN_URL and DATABASE_URL must be set (run `pnpm env:init`).');
  }
  return parsed.data;
}

export function createAdminDatabase<T = unknown>(url: string): Kysely<T> {
  return createDatabase<T>({ url, poolMax: ADMIN_POOL_SIZE, applicationName: 'mestechko-cli' });
}

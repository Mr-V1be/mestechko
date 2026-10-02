import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './generated/database.js';

export type Database = DB;

const PG_DATE_OID = 1082;
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 30_000;

export interface DatabaseOptions {
  readonly url: string;
  readonly poolMax: number;
  readonly applicationName: string;
  /** Upper bound for a single statement; protects the pool from runaway queries. */
  readonly statementTimeoutMs?: number;
}

/** Calendar dates stay `YYYY-MM-DD` strings: converting them to `Date` would shift days. */
function typeParsers(): pg.TypeOverrides {
  const overrides = new pg.TypeOverrides();
  overrides.setTypeParser(PG_DATE_OID, (value: string) => value);
  return overrides;
}

export function createPool(options: DatabaseOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.url,
    max: options.poolMax,
    application_name: options.applicationName,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    ...(options.statementTimeoutMs === undefined
      ? {}
      : { statement_timeout: options.statementTimeoutMs }),
    types: typeParsers(),
  });
}

export function createDatabase<T = Database>(options: DatabaseOptions): Kysely<T> {
  return new Kysely<T>({
    dialect: new PostgresDialect({ pool: createPool(options) }),
    plugins: [new CamelCasePlugin()],
  });
}

export const DATABASE = Symbol('DATABASE');

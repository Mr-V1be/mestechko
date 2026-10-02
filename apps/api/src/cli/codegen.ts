/**
 * Regenerates Kysely table types from the migrated database (`--verify` checks only).
 * The schema is the single source of truth for persistence types.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { adminEnvironmentFrom } from './admin-database.js';

const environment = adminEnvironmentFrom();
const require = createRequire(import.meta.url);
const cli = require.resolve('kysely-codegen/dist/cli/bin.js');
const outFile = fileURLToPath(new URL('../platform/db/generated/database.ts', import.meta.url));

execFileSync(
  process.execPath,
  [
    cli,
    '--dialect=postgres',
    '--camel-case',
    '--date-parser=string',
    '--include-pattern=public.*',
    '--log-level=warn',
    `--out-file=${outFile}`,
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: environment.DATABASE_ADMIN_URL } },
);

/**
 * Regenerates Kysely table types from the migrated database; `--verify` only checks
 * that the committed file matches. The output is formatted like the rest of the code,
 * so formatting the repository never makes the check fail.
 * The schema is the single source of truth for persistence types.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { adminEnvironmentFrom } from './admin-database.js';

const environment = adminEnvironmentFrom();
const require = createRequire(import.meta.url);
const cli = require.resolve('kysely-codegen/dist/cli/bin.js');
const outFile = fileURLToPath(new URL('../platform/db/generated/database.ts', import.meta.url));
const verify = process.argv.includes('--verify');

const scratch = mkdtempSync(join(tmpdir(), 'mestechko-codegen-'));
const generated = join(scratch, 'database.ts');
try {
  execFileSync(
    process.execPath,
    [
      cli,
      '--dialect=postgres',
      '--camel-case',
      '--date-parser=string',
      '--include-pattern=public.*',
      '--log-level=warn',
      `--out-file=${generated}`,
    ],
    { stdio: 'inherit', env: { ...process.env, DATABASE_URL: environment.DATABASE_ADMIN_URL } },
  );
  const formatted = await format(readFileSync(generated, 'utf8'), {
    ...(await resolveConfig(outFile)),
    filepath: outFile,
  });
  if (verify) {
    if (readFileSync(outFile, 'utf8') !== formatted) {
      console.error('Generated database types are out of date: run `pnpm db:codegen`.');
      process.exitCode = 1;
    }
  } else {
    writeFileSync(outFile, formatted);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

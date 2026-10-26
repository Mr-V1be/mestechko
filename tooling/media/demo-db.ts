/**
 * Small adjustments of the scratch demo for captures, e.g. a reminder that is due
 * now. Runs psql inside the project's own PostgreSQL container.
 */
import { spawnSync } from 'node:child_process';

export function psql(database: string, statement: string): string {
  const admin = new URL(process.env.DATABASE_ADMIN_URL ?? 'postgres://slotwise@localhost/');
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      decodeURIComponent(admin.username),
      '-d',
      database,
      '-tA',
      '-c',
      statement,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`psql failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

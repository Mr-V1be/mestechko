import { stat, writeFile } from 'node:fs/promises';

/** How often a process without HTTP proves it is alive, and how stale a proof may get. */
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_MAX_AGE_MS = HEARTBEAT_INTERVAL_MS * 3;
export const DEFAULT_HEARTBEAT_FILE = '/tmp/mestechko-heartbeat';

/** Writes the moment of a successful check; the container's health check reads its age. */
export async function beat(file: string): Promise<void> {
  await writeFile(file, String(Date.now()));
}

/** `true` while the last successful check is recent enough. */
export async function heartbeatIsFresh(file: string, now = Date.now()): Promise<boolean> {
  try {
    const { mtimeMs } = await stat(file);
    return now - mtimeMs <= HEARTBEAT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

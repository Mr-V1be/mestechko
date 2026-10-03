/**
 * The container health check. A process with the `api` role answers its readiness probe
 * over HTTP; workers, bots and the demo reset scheduler keep a heartbeat file fresh.
 *
 *   node dist/cli/healthcheck.js [--heartbeat]
 */
import {
  DEFAULT_HEARTBEAT_FILE,
  heartbeatIsFresh,
} from '../platform/observability/heartbeat-file.js';

const PROBE_TIMEOUT_MS = 3_000;
const DEFAULT_PORT = '46210';

/** An empty variable counts as unset, as everywhere in the configuration. */
const env = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

const roles = env('APP_ROLES', 'api,worker,bot')
  .split(',')
  .map((role) => role.trim());
const byHeartbeat = process.argv.includes('--heartbeat') || !roles.includes('api');

async function healthy(): Promise<boolean> {
  if (byHeartbeat) {
    return heartbeatIsFresh(env('HEARTBEAT_FILE', DEFAULT_HEARTBEAT_FILE));
  }
  const port = env('API_PORT', DEFAULT_PORT);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

process.exit((await healthy()) ? 0 : 1);

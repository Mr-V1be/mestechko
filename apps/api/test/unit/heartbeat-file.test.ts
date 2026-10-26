import { mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  beat,
  HEARTBEAT_MAX_AGE_MS,
  heartbeatIsFresh,
} from '../../src/platform/observability/heartbeat-file.js';

describe('heartbeat file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'slotwise-heartbeat-'));
  const file = join(directory, 'heartbeat');

  afterEach(() => {
    rmSync(file, { force: true });
  });

  it('is fresh right after a beat', async () => {
    await beat(file);
    expect(await heartbeatIsFresh(file)).toBe(true);
  });

  it('goes stale when no beat came for too long', async () => {
    await beat(file);
    const past = (Date.now() - HEARTBEAT_MAX_AGE_MS - 1_000) / 1000;
    utimesSync(file, past, past);
    expect(await heartbeatIsFresh(file)).toBe(false);
  });

  it('is not fresh before the first beat', async () => {
    expect(await heartbeatIsFresh(join(directory, 'missing'))).toBe(false);
  });
});

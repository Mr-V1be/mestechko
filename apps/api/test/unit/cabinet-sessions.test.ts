import { Temporal } from '@mestechko/domain';
import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../../src/shared/application/application-error.js';
import type {
  LoginThrottle,
  PasswordHasher,
  SessionStore,
  StoredSession,
  UserAccounts,
} from '../../src/modules/identity/application/ports.js';
import { CabinetSessions } from '../../src/modules/identity/application/sessions.js';
import { RandomSessionTokens } from '../../src/modules/identity/infrastructure/crypto-adapters.js';
import type {
  BusinessDirectory,
  MembershipDirectory,
} from '../../src/modules/tenancy/application/business-directory.js';

const HOUR_MS = 3_600_000;

const unused = (): Promise<never> => Promise.reject(new Error('Not used by these scenarios'));
const memberships: MembershipDirectory = {
  listForUser: unused,
  find: unused,
  findUserWithRole: unused,
  listRoleHolders: unused,
};
const businesses: BusinessDirectory = {
  findBySlug: unused,
  findById: unused,
  listDemo: unused,
  listCountryCodes: unused,
};

function setup(options: { allowed?: boolean } = {}) {
  let now = Temporal.Instant.from('2026-10-01T10:00:00Z');
  const verified: (string | null)[] = [];
  const sessions = new Map<string, StoredSession & { tokenHash: Buffer }>();
  const accounts: UserAccounts = {
    findByEmail: (email) =>
      Promise.resolve(
        email === 'owner@example.test'
          ? { id: 'u1', email, displayName: 'Owner', passwordHash: 'hash' }
          : null,
      ),
    findById: () => Promise.resolve(null),
  };
  const hasher: PasswordHasher = {
    hash: () => Promise.resolve('hash'),
    verify: (password, hash) => {
      verified.push(hash);
      return Promise.resolve(hash === 'hash' && password === 'right');
    },
  };
  const store: SessionStore = {
    create: (session) => {
      sessions.set(session.id, session);
      return Promise.resolve();
    },
    findActive: (hash, at) =>
      Promise.resolve(
        [...sessions.values()].find(
          (session) => session.tokenHash.equals(hash) && session.expiresAt > at,
        ) ?? null,
      ),
    touch: (id, lastSeenAt, expiresAt) => {
      const session = sessions.get(id);
      if (session) {
        sessions.set(id, { ...session, lastSeenAt, expiresAt });
      }
      return Promise.resolve();
    },
    delete: (id) => {
      sessions.delete(id);
      return Promise.resolve();
    },
  };
  const throttle: LoginThrottle = {
    consume: () => Promise.resolve({ allowed: options.allowed ?? true, retryAfterSeconds: 60 }),
    reset: () => Promise.resolve(),
  };
  let sequence = 0;
  const service = new CabinetSessions(
    accounts,
    store,
    hasher,
    throttle,
    new RandomSessionTokens(),
    memberships,
    businesses,
    { next: () => `s${String((sequence += 1))}` },
    { now: () => now },
    { ttlDays: 30, demoEnabled: false },
  );
  return {
    service,
    verified,
    sessions,
    advance: (ms: number) => (now = now.add({ milliseconds: ms })),
  };
}

describe('cabinet sessions', () => {
  it('issues a session that authenticates and extends itself on use', async () => {
    const { service, sessions, advance } = setup();
    const issued = await service.signIn('owner@example.test', 'right', '127.0.0.1');
    advance(2 * HOUR_MS);
    const session = await service.authenticate(issued.token);
    expect(session.userId).toBe('u1');
    expect(sessions.get(session.sessionId)?.expiresAt.getTime()).toBeGreaterThan(
      issued.expiresAt.getTime(),
    );
  });

  it('spends the same hashing work for unknown accounts and wrong passwords', async () => {
    const { service, verified } = setup();
    await expect(service.signIn('nobody@example.test', 'x', '127.0.0.1')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(service.signIn('owner@example.test', 'wrong', '127.0.0.1')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(verified).toEqual([null, 'hash']);
  });

  it('refuses sign-in while throttled', async () => {
    const { service } = setup({ allowed: false });
    await expect(service.signIn('owner@example.test', 'right', '127.0.0.1')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('forgets a session after sign-out and after expiry', async () => {
    const { service, advance } = setup();
    const first = await service.signIn('owner@example.test', 'right', '127.0.0.1');
    const session = await service.authenticate(first.token);
    await service.signOut(session.sessionId);
    await expect(service.authenticate(first.token)).rejects.toBeInstanceOf(ApplicationError);
    const second = await service.signIn('owner@example.test', 'right', '127.0.0.1');
    advance(31 * 24 * HOUR_MS);
    await expect(service.authenticate(second.token)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});

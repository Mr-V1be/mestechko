import type { RateLimiter } from '../../../shared/application/rate-limits.js';
import type { Clock, RoleId } from '@mestechko/domain';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type {
  MembershipDirectory,
  BusinessDirectory,
} from '../../tenancy/application/business-directory.js';
import type { PasswordHasher, SessionStore, SessionTokens, UserAccounts } from './ports.js';

const MS_PER_DAY = 86_400_000;
/** Sliding expiry is extended at most this often to avoid a write per request. */
const TOUCH_INTERVAL_MS = 3_600_000;
export interface SessionSettings {
  readonly ttlDays: number;
  readonly demoEnabled: boolean;
}

export interface IssuedSession {
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface AuthenticatedSession {
  readonly userId: string;
  readonly sessionId: string;
}

export class CabinetSessions {
  constructor(
    private readonly accounts: UserAccounts,
    private readonly store: SessionStore,
    private readonly hasher: PasswordHasher,
    private readonly limits: RateLimiter,
    private readonly tokens: SessionTokens,
    private readonly memberships: MembershipDirectory,
    private readonly businesses: BusinessDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: SessionSettings,
  ) {}

  async signIn(email: string, password: string, clientAddress: string): Promise<IssuedSession> {
    const emailKey = `email:${email.toLowerCase()}`;
    for (const key of [`address:${clientAddress}`, emailKey]) {
      const verdict = await this.limits.consume('login', key);
      if (!verdict.allowed) {
        throw new ApplicationError('rate_limited', 'Too many sign-in attempts', {
          retryAfterSeconds: verdict.retryAfterSeconds,
        });
      }
    }
    const account = await this.accounts.findByEmail(email);
    const valid = await this.hasher.verify(password, account?.passwordHash ?? null);
    if (!account || !valid) {
      throw new ApplicationError('invalid_credentials', 'Invalid email or password');
    }
    await this.limits.reset('login', emailKey);
    return this.issue(account.id);
  }

  /** Signs in as the demo persona holding the role. Unavailable outside demo mode. */
  async signInDemo(businessSlug: string, role: RoleId): Promise<IssuedSession> {
    const business = this.settings.demoEnabled
      ? await this.businesses.findBySlug(businessSlug)
      : null;
    if (!business?.isDemo) {
      throw new ApplicationError('not_found', 'Demo business not found');
    }
    const userId = await this.memberships.findUserWithRole(business.id, role);
    if (!userId) {
      throw new ApplicationError('not_found', 'Demo account not found');
    }
    return this.issue(userId);
  }

  async authenticate(token: string): Promise<AuthenticatedSession> {
    const now = new Date(this.clock.now().epochMilliseconds);
    const session = await this.store.findActive(this.tokens.hash(token), now);
    if (!session) {
      throw new ApplicationError('unauthenticated', 'Session expired');
    }
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.store.touch(session.id, now, this.expiryFrom(now));
    }
    return { userId: session.userId, sessionId: session.id };
  }

  async signOut(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }

  private async issue(userId: string): Promise<IssuedSession> {
    const now = new Date(this.clock.now().epochMilliseconds);
    const { token, hash } = this.tokens.issue();
    const expiresAt = this.expiryFrom(now);
    await this.store.create({
      id: this.ids.next(),
      userId,
      tokenHash: hash,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });
    return { token, userId, expiresAt };
  }

  private expiryFrom(now: Date): Date {
    return new Date(now.getTime() + this.settings.ttlDays * MS_PER_DAY);
  }
}

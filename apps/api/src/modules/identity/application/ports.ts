import type {
  TelegramClientUser,
  TelegramUser,
} from '../../../shared/application/messenger-user.js';

export interface UserAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
}

export interface UserAccounts {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
}

export interface StoredSession {
  readonly id: string;
  readonly userId: string;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

export interface SessionStore {
  create(
    session: StoredSession & { readonly tokenHash: Buffer; readonly createdAt: Date },
  ): Promise<void>;
  findActive(tokenHash: Buffer, now: Date): Promise<StoredSession | null>;
  touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /**
   * Checks a password against a stored hash. Without a hash (unknown account) it spends
   * the same time and returns false, so response timing does not reveal accounts.
   */
  verify(password: string, hash: string | null): Promise<boolean>;
}

export interface ThrottleVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

/** Limits sign-in attempts per key (address, email) against password guessing. */
export interface LoginThrottle {
  consume(key: string): Promise<ThrottleVerdict>;
  reset(key: string): Promise<void>;
}

/** Opaque session tokens: only their hash is stored. */
export interface SessionTokens {
  issue(): { readonly token: string; readonly hash: Buffer };
  hash(token: string): Buffer;
}

export interface TelegramLaunch {
  readonly user: TelegramClientUser;
  readonly startParam: string | null;
}

/** Checks Telegram Mini App launch data (signature and freshness) on the server. */
export interface TelegramLaunchVerifier {
  verify(initData: string): TelegramLaunch;
}

/** Signs launch data for the demo emulator, exactly as Telegram would. */
export interface TelegramLaunchSigner {
  sign(launch: { readonly user: TelegramUser; readonly startParam: string }): string;
}

export const USER_ACCOUNTS = Symbol('USER_ACCOUNTS');
export const SESSION_STORE = Symbol('SESSION_STORE');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const LOGIN_THROTTLE = Symbol('LOGIN_THROTTLE');
export const SESSION_TOKENS = Symbol('SESSION_TOKENS');
export const TELEGRAM_LAUNCH_VERIFIER = Symbol('TELEGRAM_LAUNCH_VERIFIER');
export const TELEGRAM_LAUNCH_SIGNER = Symbol('TELEGRAM_LAUNCH_SIGNER');

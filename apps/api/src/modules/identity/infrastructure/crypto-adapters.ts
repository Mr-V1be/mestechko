import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher, SessionTokens } from '../application/ports.js';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** OWASP-recommended scrypt profile (N=2^15, r=8, p=3), about 32 MiB per hash. */
const SCRYPT = { N: 32_768, r: 8, p: 3 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;
const FORMAT = 'scrypt';

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await scryptAsync(password, salt, KEY_LENGTH, { ...SCRYPT, maxmem: MAX_MEMORY });
    return [
      FORMAT,
      SCRYPT.N,
      SCRYPT.r,
      SCRYPT.p,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, stored: string | null): Promise<boolean> {
    const parts = stored?.split('$') ?? [];
    const [format, n, r, p, salt, key] = parts;
    const known = parts.length === 6 && format === FORMAT && salt && key;
    const params = known
      ? { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMORY }
      : { ...SCRYPT, maxmem: MAX_MEMORY };
    const expected = known ? Buffer.from(key, 'base64url') : randomBytes(KEY_LENGTH);
    const saltBytes = known ? Buffer.from(salt, 'base64url') : randomBytes(SALT_LENGTH);
    const actual = await scryptAsync(password, saltBytes, expected.length, params);
    return Boolean(known) && timingSafeEqual(actual, expected);
  }
}

const TOKEN_BYTES = 32;

export class RandomSessionTokens implements SessionTokens {
  issue(): { token: string; hash: Buffer } {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): Buffer {
    return createHash('sha256').update(token).digest();
  }
}

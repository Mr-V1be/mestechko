import type { FastifyRequest } from 'fastify';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { Authenticator, Principal } from '../../../platform/http/principal.js';
import type { TelegramLaunchVerifier } from '../application/ports.js';
import type { CabinetSessions } from '../application/sessions.js';
import { readSessionCookie } from './session-cookie.js';

const TELEGRAM_SCHEME = 'tma ';

export class SessionAuthenticator implements Authenticator {
  constructor(private readonly sessions: CabinetSessions) {}

  async authenticate(request: FastifyRequest): Promise<Principal> {
    const token = readSessionCookie(request);
    if (!token) {
      throw new ApplicationError('unauthenticated', 'Sign in required');
    }
    const session = await this.sessions.authenticate(token);
    return { kind: 'session', userId: session.userId, sessionId: session.sessionId };
  }
}

/** `Authorization: tma <initData>` as sent by the Mini App on every request. */
export class TelegramAuthenticator implements Authenticator {
  constructor(private readonly verifier: TelegramLaunchVerifier) {}

  authenticate(request: FastifyRequest): Promise<Principal> {
    const header = request.headers.authorization;
    if (!header?.startsWith(TELEGRAM_SCHEME)) {
      return Promise.reject(
        new ApplicationError('telegram_auth_invalid', 'Telegram launch data required'),
      );
    }
    try {
      const launch = this.verifier.verify(header.slice(TELEGRAM_SCHEME.length));
      return Promise.resolve({ kind: 'telegram', user: launch.user });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

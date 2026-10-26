import type { AuthKind } from '@slotwise/contracts';
import type { FastifyRequest } from 'fastify';
import type { BusinessAccess } from '../../shared/application/business-access.js';
import type { TelegramClientUser } from '../../shared/application/messenger-user.js';

export type { BusinessAccess };
/** The verified Telegram user of a Mini App request. */
export type TelegramUser = TelegramClientUser;

export type Principal =
  | { readonly kind: 'session'; readonly userId: string; readonly sessionId: string }
  | { readonly kind: 'telegram'; readonly user: TelegramUser };

export interface Authenticator {
  /** Resolves the caller or throws an `unauthenticated`-family application error. */
  authenticate(request: FastifyRequest): Promise<Principal>;
}

export type AuthenticatorRegistry = ReadonlyMap<Exclude<AuthKind, 'none'>, Authenticator>;

export const AUTHENTICATORS = Symbol('AUTHENTICATORS');

/** Fields added to every log line of a request once the caller is known. */
export interface LogContext {
  userId?: string;
  telegramUserId?: string;
  businessId?: string;
}

export interface LogContextCarrier {
  logContext?: LogContext;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
    businessAccess?: BusinessAccess;
  }
}

export function addLogContext(request: FastifyRequest, context: LogContext): void {
  const carrier = request.raw as LogContextCarrier;
  carrier.logContext = { ...carrier.logContext, ...context };
}

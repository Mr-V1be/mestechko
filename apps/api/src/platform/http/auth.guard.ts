import {
  createParamDecorator,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApplicationError } from '../../shared/application/application-error.js';
import { routeSpecOf } from './contract-route.js';
import {
  addLogContext,
  AUTHENTICATORS,
  type AuthenticatorRegistry,
  type BusinessAccess,
  type Principal,
  type TelegramUser,
} from './principal.js';

/** Authenticates every contract route by the auth kind its contract declares. */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authenticators: AuthenticatorRegistry;

  constructor(@Inject(AUTHENTICATORS) authenticators: AuthenticatorRegistry) {
    this.authenticators = authenticators;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const route = routeSpecOf(context.getHandler());
    if (!route || route.auth === 'none') {
      return true;
    }
    const authenticator = this.authenticators.get(route.auth);
    if (!authenticator) {
      throw new Error(`No authenticator registered for "${route.auth}"`);
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = await authenticator.authenticate(request);
    request.principal = principal;
    addLogContext(
      request,
      principal.kind === 'session'
        ? { userId: principal.userId }
        : { telegramUserId: principal.user.id },
    );
    return true;
  }
}

function principalOf(context: ExecutionContext): Principal {
  const principal = context.switchToHttp().getRequest<FastifyRequest>().principal;
  if (!principal) {
    throw new ApplicationError('unauthenticated', 'Authentication required');
  }
  return principal;
}

/** Signed-in cabinet user of a `session` route. */
export const SessionUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): { userId: string; sessionId: string } => {
    const principal = principalOf(context);
    if (principal.kind !== 'session') {
      throw new ApplicationError('unauthenticated', 'Cabinet session required');
    }
    return { userId: principal.userId, sessionId: principal.sessionId };
  },
);

/** Telegram user of a `telegram` route. */
export const TelegramClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TelegramUser => {
    const principal = principalOf(context);
    if (principal.kind !== 'telegram') {
      throw new ApplicationError('unauthenticated', 'Telegram launch data required');
    }
    return principal.user;
  },
);

/** Membership verified by the business access guard. */
export const CurrentBusinessAccess = createParamDecorator(
  (_data: unknown, context: ExecutionContext): BusinessAccess => {
    const access = context.switchToHttp().getRequest<FastifyRequest>().businessAccess;
    if (!access) {
      throw new Error('@CurrentBusinessAccess() requires @RequireAccess() on the handler');
    }
    return access;
  },
);

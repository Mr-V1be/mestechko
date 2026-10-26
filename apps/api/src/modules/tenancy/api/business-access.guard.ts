import {
  applyDecorators,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { accessScope, type AccessArea } from '@slotwise/domain';
import type { FastifyRequest } from 'fastify';
import { ApplicationError } from '../../../shared/application/application-error.js';
import { addLogContext } from '../../../platform/http/principal.js';
import {
  MEMBERSHIP_DIRECTORY,
  type MembershipDirectory,
} from '../application/business-directory.js';

const ACCESS_AREA = Symbol('ACCESS_AREA');

/**
 * Verifies that the signed-in user belongs to the business in `:businessId` and that
 * their role grants the area. The resolved scope (`own` or `all`) is passed on.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(@Inject(MEMBERSHIP_DIRECTORY) private readonly memberships: MembershipDirectory) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const area = Reflect.getMetadata(ACCESS_AREA, context.getHandler()) as AccessArea | undefined;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;
    const businessId = (request.params as { businessId?: unknown }).businessId;
    if (!area || principal?.kind !== 'session' || typeof businessId !== 'string') {
      throw new Error('@RequireAccess() needs a session route with a :businessId parameter');
    }
    const membership = await this.memberships.find(principal.userId, businessId);
    const scope = membership ? accessScope(membership.role, area) : 'none';
    if (!membership || scope === 'none') {
      throw new ApplicationError('forbidden', 'No access to this business area');
    }
    request.businessAccess = {
      businessId,
      role: membership.role,
      staffId: membership.staffId,
      scope,
    };
    addLogContext(request, { businessId });
    return true;
  }
}

export function RequireAccess(area: AccessArea): MethodDecorator {
  return applyDecorators(SetMetadata(ACCESS_AREA, area), UseGuards(BusinessAccessGuard));
}

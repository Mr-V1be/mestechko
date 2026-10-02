import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { RouteSpec } from '@mestechko/contracts';
import { map, type Observable } from 'rxjs';
import { routeSpecOf } from './contract-route.js';

export class ContractViolationError extends Error {
  readonly issues: unknown;

  constructor(route: RouteSpec, issues: unknown) {
    super(`Response of ${route.method} ${route.path} violates its contract`);
    this.name = 'ContractViolationError';
    this.issues = issues;
  }
}

/**
 * Serializes responses through the route's response schema. Unknown fields are
 * stripped, so internal data never leaks, and contract drift fails loudly.
 */
@Injectable()
export class ContractResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const route = routeSpecOf(context.getHandler());
    if (!route) {
      return next.handle();
    }
    return next.handle().pipe(
      map((value: unknown) => {
        if (route.response === null) {
          return undefined;
        }
        const parsed = route.response.safeParse(value);
        if (!parsed.success) {
          throw new ContractViolationError(route, parsed.error.issues);
        }
        return parsed.data;
      }),
    );
  }
}

import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { isFileSpec, type RouteSpec, type ServedFile } from '@mestechko/contracts';
import type { FastifyReply } from 'fastify';
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

/** `filename*` per RFC 6266, so names in any script survive. */
function attachment(fileName: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Serializes responses through the route's response schema. Unknown fields are
 * stripped, so internal data never leaks, and contract drift fails loudly. File
 * responses are sent as they are, with their media type and name.
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
        if (isFileSpec(route.response)) {
          const file = value as ServedFile;
          if (!route.response.mediaTypes.includes(file.mediaType)) {
            throw new ContractViolationError(route, [`media type ${file.mediaType}`]);
          }
          void context
            .switchToHttp()
            .getResponse<FastifyReply>()
            .header('content-type', file.mediaType)
            .header('content-disposition', attachment(file.fileName));
          return Buffer.from(file.content);
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

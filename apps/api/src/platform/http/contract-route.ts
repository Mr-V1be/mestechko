import {
  applyDecorators,
  createParamDecorator,
  HttpCode,
  RequestMapping,
  RequestMethod,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { HttpMethod, RouteInput, RouteSpec } from '@mestechko/contracts';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { ApplicationError } from '../../shared/application/application-error.js';

export const ROUTE_SPEC = Symbol('ROUTE_SPEC');

const requestMethods: Record<HttpMethod, RequestMethod> = {
  GET: RequestMethod.GET,
  POST: RequestMethod.POST,
  PUT: RequestMethod.PUT,
  PATCH: RequestMethod.PATCH,
  DELETE: RequestMethod.DELETE,
};

/** Binds a handler to a route of the shared contract: path, method, status and schemas. */
export function ContractRoute(route: RouteSpec): MethodDecorator {
  return applyDecorators(
    RequestMapping({ path: route.path, method: requestMethods[route.method] }),
    HttpCode(route.status),
    SetMetadata(ROUTE_SPEC, route),
  );
}

export function routeSpecOf(handler: object): RouteSpec | undefined {
  return Reflect.getMetadata(ROUTE_SPEC, handler) as RouteSpec | undefined;
}

type RequestPart = 'params' | 'query' | 'body' | 'headers';

function parsePart(schema: z.ZodType | undefined, value: unknown, part: RequestPart): unknown {
  if (!schema) {
    return undefined;
  }
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new ApplicationError(
      'validation_failed',
      `Invalid request ${part}`,
      result.error.issues.map((issue) => ({
        path: [part, ...issue.path.map(String)].join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export function parseRouteInput(route: RouteSpec, request: FastifyRequest): RouteInput<RouteSpec> {
  return {
    params: parsePart(route.params, request.params, 'params'),
    query: parsePart(route.query, request.query, 'query'),
    body: route.body ? parsePart(route.body, request.body ?? null, 'body') : undefined,
    headers: parsePart(route.headers, request.headers, 'headers'),
  } as RouteInput<RouteSpec>;
}

/** Validated input of the current contract route. */
export const ContractInput = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const route = routeSpecOf(context.getHandler());
  if (!route) {
    throw new Error('@ContractInput() requires @ContractRoute() on the handler');
  }
  return parseRouteInput(route, context.switchToHttp().getRequest<FastifyRequest>());
});

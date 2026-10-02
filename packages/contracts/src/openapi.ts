import { z } from 'zod';
import { apiErrorBodySchema, apiErrors } from './errors.js';
import type { AuthKind, RouteSpec } from './route.js';

type JsonObject = Record<string, unknown>;

const securitySchemes: Record<Exclude<AuthKind, 'none'>, JsonObject> = {
  session: { type: 'apiKey', in: 'cookie', name: 'mst_session' },
  telegram: {
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'Telegram Mini App launch data: `tma <initData>`',
  },
};

function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonObject {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  return rest;
}

function parameters(schema: z.ZodType | undefined, location: 'path' | 'query' | 'header') {
  if (!schema) {
    return [];
  }
  const objectSchema = jsonSchema(schema, 'input') as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  return Object.entries(objectSchema.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || (objectSchema.required ?? []).includes(name),
    schema: property,
  }));
}

function operation(operationId: string, route: RouteSpec): JsonObject {
  const errorResponse = {
    content: { 'application/json': { schema: jsonSchema(apiErrorBodySchema, 'output') } },
  };
  return {
    operationId,
    summary: route.summary,
    tags: [route.tag],
    ...(route.auth === 'none' ? { security: [] } : { security: [{ [route.auth]: [] }] }),
    parameters: [
      ...parameters(route.params, 'path'),
      ...parameters(route.query, 'query'),
      ...parameters(route.headers, 'header'),
    ],
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: jsonSchema(route.body, 'input') } },
          },
        }
      : {}),
    responses: {
      [String(route.status)]: route.response
        ? {
            description: 'Success',
            content: { 'application/json': { schema: jsonSchema(route.response, 'output') } },
          }
        : { description: 'Success, no content' },
      default: { description: 'Error', ...errorResponse },
    },
  };
}

/** OpenAPI 3.1 document derived from the route registry. */
export function buildOpenApiDocument(routes: Readonly<Record<string, RouteSpec>>): JsonObject {
  const paths: Record<string, Record<string, JsonObject>> = {};
  for (const [operationId, route] of Object.entries(routes)) {
    const path = route.path.replace(/:([A-Za-z]+)/g, '{$1}');
    paths[path] = { ...paths[path], [route.method.toLowerCase()]: operation(operationId, route) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Mestechko API',
      version: '1.0.0',
      description: `Error codes: ${Object.keys(apiErrors).join(', ')}`,
    },
    paths,
    components: { securitySchemes },
  };
}

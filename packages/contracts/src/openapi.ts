import { z } from 'zod';
import { apiErrorBodySchema, apiErrors } from './errors.js';
import { isFileSpec, type AuthKind, type FileSpec, type RouteSpec } from './route.js';

type JsonObject = Record<string, unknown>;

const securitySchemes: Record<Exclude<AuthKind, 'none'>, JsonObject> = {
  session: { type: 'apiKey', in: 'cookie', name: 'slotwise_session' },
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

function fileContent(file: FileSpec): JsonObject {
  return Object.fromEntries(
    file.mediaTypes.map((mediaType) => [
      mediaType,
      { schema: { type: 'string', contentMediaType: mediaType, maxLength: file.maxBytes } },
    ]),
  );
}

function requestBody(route: RouteSpec): JsonObject {
  if (route.upload) {
    return { requestBody: { required: true, content: fileContent(route.upload) } };
  }
  return route.body
    ? {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: jsonSchema(route.body, 'input') } },
        },
      }
    : {};
}

function successResponse(route: RouteSpec): JsonObject {
  if (route.response === null) {
    return { description: 'Success, no content' };
  }
  if (isFileSpec(route.response)) {
    return { description: 'File', content: fileContent(route.response) };
  }
  return {
    description: 'Success',
    content: { 'application/json': { schema: jsonSchema(route.response, 'output') } },
  };
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
    ...requestBody(route),
    responses: {
      [String(route.status)]: successResponse(route),
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
      title: 'Slotwise API',
      version: '1.0.0',
      description: `Error codes: ${Object.keys(apiErrors).join(', ')}`,
    },
    paths,
    components: { securitySchemes },
  };
}

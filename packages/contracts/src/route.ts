import type { z } from 'zod';

export const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof httpMethods)[number];

/** How a caller proves identity: none, cabinet session cookie or Telegram launch data. */
export const authKinds = ['none', 'session', 'telegram'] as const;
export type AuthKind = (typeof authKinds)[number];

/** A file travelling as the raw request or response body, e.g. a spreadsheet. */
export interface FileSpec {
  readonly kind: 'file';
  readonly mediaTypes: readonly [string, ...string[]];
  readonly maxBytes: number;
}

export function fileSpec(mediaTypes: readonly [string, ...string[]], maxBytes: number): FileSpec {
  return { kind: 'file', mediaTypes, maxBytes };
}

export function isFileSpec(value: unknown): value is FileSpec {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'file';
}

export interface RouteSpec {
  readonly method: HttpMethod;
  /** Path with `:param` placeholders. */
  readonly path: string;
  readonly summary: string;
  readonly tag: string;
  readonly auth: AuthKind;
  readonly status: number;
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  /** A file as the request body, instead of JSON. */
  readonly upload?: FileSpec;
  readonly headers?: z.ZodType;
  /** JSON schema, a file, or `null` for responses without a body. */
  readonly response: z.ZodType | FileSpec | null;
}

export function defineRoute<const R extends RouteSpec>(route: R): R {
  return route;
}

type InputPart<
  R extends RouteSpec,
  K extends 'params' | 'query' | 'body' | 'headers',
> = R[K] extends z.ZodType
  ? Readonly<Record<K, z.input<R[K]>>>
  : Partial<Readonly<Record<K, never>>>;

type UploadPart<R extends RouteSpec> = R['upload'] extends FileSpec
  ? { readonly file: Blob }
  : { readonly file?: never };

/** What a client sends. */
export type RouteRequest<R extends RouteSpec> = InputPart<R, 'params'> &
  InputPart<R, 'query'> &
  InputPart<R, 'body'> &
  InputPart<R, 'headers'> &
  UploadPart<R>;

type ParsedPart<
  R extends RouteSpec,
  K extends 'params' | 'query' | 'body' | 'headers',
> = R[K] extends z.ZodType ? z.output<R[K]> : undefined;

/** An uploaded file as a handler receives it, checked against the route's media types. */
export interface UploadedFile {
  readonly content: Uint8Array;
  readonly mediaType: string;
}

/** What a handler receives after validation. */
export interface RouteInput<R extends RouteSpec> {
  readonly params: ParsedPart<R, 'params'>;
  readonly query: ParsedPart<R, 'query'>;
  readonly body: ParsedPart<R, 'body'>;
  readonly headers: ParsedPart<R, 'headers'>;
  readonly file: R['upload'] extends FileSpec ? UploadedFile : undefined;
}

/** A file a handler serves. */
export interface ServedFile {
  readonly fileName: string;
  readonly mediaType: string;
  readonly content: Uint8Array;
}

/** What a handler returns. */
export type RouteResult<R extends RouteSpec> = R['response'] extends z.ZodType
  ? z.output<R['response']>
  : R['response'] extends FileSpec
    ? ServedFile
    : undefined;

/** What a client receives: files arrive as blobs. */
export type ClientResult<R extends RouteSpec> = R['response'] extends FileSpec
  ? Blob
  : RouteResult<R>;

export function buildPath(
  path: string,
  params: Readonly<Record<string, string>> | undefined,
): string {
  return path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${path}`);
    }
    return encodeURIComponent(value);
  });
}

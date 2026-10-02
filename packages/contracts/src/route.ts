import type { z } from 'zod';

export const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof httpMethods)[number];

/** How a caller proves identity: none, cabinet session cookie or Telegram launch data. */
export const authKinds = ['none', 'session', 'telegram'] as const;
export type AuthKind = (typeof authKinds)[number];

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
  readonly headers?: z.ZodType;
  /** `null` for responses without a body. */
  readonly response: z.ZodType | null;
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

/** What a client sends. */
export type RouteRequest<R extends RouteSpec> = InputPart<R, 'params'> &
  InputPart<R, 'query'> &
  InputPart<R, 'body'> &
  InputPart<R, 'headers'>;

type ParsedPart<
  R extends RouteSpec,
  K extends 'params' | 'query' | 'body' | 'headers',
> = R[K] extends z.ZodType ? z.output<R[K]> : undefined;

/** What a handler receives after validation. */
export interface RouteInput<R extends RouteSpec> {
  readonly params: ParsedPart<R, 'params'>;
  readonly query: ParsedPart<R, 'query'>;
  readonly body: ParsedPart<R, 'body'>;
  readonly headers: ParsedPart<R, 'headers'>;
}

/** What a handler returns and a client receives. */
export type RouteResult<R extends RouteSpec> = R['response'] extends z.ZodType
  ? z.output<R['response']>
  : undefined;

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

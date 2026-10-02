import type { AuthKind, HttpMethod } from './route.js';

/** How a response body arrives. */
export type ResponseKind = 'json' | 'file' | 'none';

/** What a client needs at runtime to call a route: no schemas, no validation code. */
export interface RouteMeta {
  readonly method: HttpMethod;
  readonly path: string;
  readonly status: number;
  readonly auth: AuthKind;
  readonly response: ResponseKind;
  /** Whether the request body is a file rather than JSON. */
  readonly upload: boolean;
}

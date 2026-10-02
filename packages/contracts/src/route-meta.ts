import type { AuthKind, HttpMethod } from './route.js';

/** What a client needs at runtime to call a route: no schemas, no validation code. */
export interface RouteMeta {
  readonly method: HttpMethod;
  readonly path: string;
  readonly status: number;
  readonly auth: AuthKind;
  readonly hasResponseBody: boolean;
}

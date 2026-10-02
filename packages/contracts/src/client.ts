import type { ApiErrorCode } from './errors.js';
import { routeManifest } from './generated/route-manifest.js';
import { buildPath, type ClientResult, type RouteRequest } from './route.js';
import type { ApiRoutes } from './routes/index.js';

/** Failures that never reached a valid API response. */
export type TransportErrorCode = 'network_error' | 'timeout' | 'unexpected_response';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | TransportErrorCode;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(input: {
    status: number;
    code: ApiErrorCode | TransportErrorCode;
    message: string;
    details?: unknown;
    requestId?: string | undefined;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
  }
}

const SERVER_ERROR = 500;
const TOO_MANY_REQUESTS = 429;

/**
 * Whether repeating the same request may succeed: transport failures and server-side
 * errors may be transient, client errors (validation, auth, not found) never are.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  return error.status === 0 || error.status === TOO_MANY_REQUESTS || error.status >= SERVER_ERROR;
}

export interface ApiClientOptions {
  /** Absolute or same-origin prefix, e.g. `/api`. */
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly credentials?: RequestInit['credentials'];
  /** Value of the Authorization header, evaluated per request. */
  readonly authorization?: () => string | null;
  readonly timeoutMs?: number;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export type RouteName = keyof ApiRoutes;

export interface ApiClient {
  request<K extends RouteName>(
    route: K,
    input: RouteRequest<ApiRoutes[K]>,
    options?: RequestOptions,
  ): Promise<ClientResult<ApiRoutes[K]>>;
  /** Address of a GET route, e.g. for a download link the browser follows itself. */
  href<K extends RouteName>(route: K, input: RouteRequest<ApiRoutes[K]>): string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

type QueryScalar = string | number | boolean;

function queryValue(value: QueryScalar | readonly QueryScalar[]): string {
  return Array.isArray(value) ? value.map(String).join(',') : String(value);
}

function queryString(query: unknown): string {
  if (query === undefined || query === null) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(
    query as Record<string, QueryScalar | readonly QueryScalar[] | null | undefined>,
  )) {
    if (value !== undefined && value !== null) {
      search.set(key, queryValue(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

/** Reads the error envelope by shape; clients carry no schema library. */
async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error =
    typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  if (typeof error === 'object' && error !== null) {
    const { code, message, details, requestId } = error as Record<string, unknown>;
    if (typeof code === 'string' && typeof message === 'string') {
      return new ApiError({
        status: response.status,
        code: code as ApiErrorCode,
        message,
        details,
        requestId: typeof requestId === 'string' ? requestId : undefined,
      });
    }
  }
  return new ApiError({
    status: response.status,
    code: 'unexpected_response',
    message: `Unexpected response ${String(response.status)}`,
  });
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const urlOf = (name: RouteName, input: { params?: unknown; query?: unknown }): string => {
    const route = routeManifest[name];
    const params = input.params as Readonly<Record<string, string>> | undefined;
    return `${options.baseUrl}${buildPath(route.path, params)}${queryString(input.query)}`;
  };

  return {
    href: (name, input) => urlOf(name, input),

    async request(name, input, requestOptions = {}) {
      const route = routeManifest[name];
      const url = urlOf(name, input);
      const headers = new Headers({
        accept: route.response === 'file' ? '*/*' : 'application/json',
      });
      const requestHeaders: Readonly<Record<string, string>> = input.headers ?? {};
      for (const [header, value] of Object.entries(requestHeaders)) {
        headers.set(header, value);
      }
      const authorization = options.authorization?.();
      if (authorization) {
        headers.set('authorization', authorization);
      }
      const file = route.upload ? input.file : undefined;
      const hasBody = input.body !== undefined;
      if (file) {
        headers.set('content-type', file.type || 'application/octet-stream');
      } else if (hasBody) {
        headers.set('content-type', 'application/json');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = requestOptions.signal
        ? AbortSignal.any([requestOptions.signal, timeout])
        : timeout;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: route.method,
          headers,
          body: file ?? (hasBody ? JSON.stringify(input.body) : null),
          credentials: options.credentials ?? 'same-origin',
          signal,
        });
      } catch (error) {
        if (requestOptions.signal?.aborted) {
          throw error;
        }
        const timedOut = timeout.aborted;
        throw new ApiError({
          status: 0,
          code: timedOut ? 'timeout' : 'network_error',
          message: timedOut ? 'Request timed out' : 'Network request failed',
        });
      }
      if (!response.ok) {
        throw await toApiError(response);
      }
      switch (route.response) {
        case 'none':
          return undefined as never;
        case 'file':
          return (await response.blob()) as never;
        case 'json':
          return (await response.json()) as never;
      }
    },
  };
}

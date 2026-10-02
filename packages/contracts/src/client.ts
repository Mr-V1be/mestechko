import { apiErrorBodySchema, type ApiErrorCode } from './errors.js';
import { buildPath, type RouteRequest, type RouteResult, type RouteSpec } from './route.js';

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
    if (value === undefined || value === null) {
      continue;
    }
    search.set(key, queryValue(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = apiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return new ApiError({
      status: response.status,
      code: 'unexpected_response',
      message: `Unexpected response ${String(response.status)}`,
    });
  }
  const { code, message, details, requestId } = parsed.data.error;
  return new ApiError({ status: response.status, code, message, details, requestId });
}

export interface ApiClient {
  request<R extends RouteSpec>(
    route: R,
    input: RouteRequest<R>,
    options?: RequestOptions,
  ): Promise<RouteResult<R>>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async request(route, input, requestOptions = {}) {
      const params = input.params as Readonly<Record<string, string>> | undefined;
      const url = `${options.baseUrl}${buildPath(route.path, params)}${queryString(input.query)}`;
      const headers = new Headers({ accept: 'application/json' });
      const requestHeaders: Readonly<Record<string, string>> = input.headers ?? {};
      for (const [name, value] of Object.entries(requestHeaders)) {
        headers.set(name, value);
      }
      const authorization = options.authorization?.();
      if (authorization) {
        headers.set('authorization', authorization);
      }
      const hasBody = input.body !== undefined;
      if (hasBody) {
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
          body: hasBody ? JSON.stringify(input.body) : null,
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
      if (route.response === null) {
        return undefined as never;
      }
      return (await response.json()) as never;
    },
  };
}

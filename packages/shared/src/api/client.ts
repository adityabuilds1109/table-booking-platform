import type { z } from 'zod';
import { apiErrorBodySchema } from './schemas';

// Every failed call becomes one of these, so UI code only has to handle a single error type:
//  - the server's own errors keep its code and message ({ "error": { "code", "message" } }), e.g. SLOT_TAKEN;
//  - NETWORK_ERROR (status 0): the server could not be reached at all;
//  - BAD_RESPONSE: the server answered, but not with the shape the client expects;
//  - HTTP_ERROR: a failure status whose body is not in the server's error shape (for example a proxy's 502 page).
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH';

export type RequestOptions<S extends z.ZodType> = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  // The success body is parsed with this; the request resolves to the schema's output type.
  schema: S;
  // Lets a page cancel an in-flight request when it unmounts or the user changes the search.
  signal?: AbortSignal;
};

export type ApiClientOptions = {
  baseUrl: string;
  // Called on every request. Returning null means "not logged in" and no Authorization header is sent.
  getToken: () => string | null;
  // Called when the server answers 401 UNAUTHORIZED (token expired, user deleted): the app should log the user out.
  onUnauthorized: () => void;
  // Injectable for tests; defaults to the browser's fetch.
  fetchFn?: typeof fetch;
};

export type RequestFn = ReturnType<typeof createRequest>;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions<z.ZodType>['query']): string {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// The body as JSON, or undefined when it is empty or not JSON. Callers treat undefined as "no usable body".
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return undefined;
  }
}

export function createRequest({
  baseUrl,
  getToken,
  onUnauthorized,
  fetchFn = (input, init) => fetch(input, init),
}: ApiClientOptions) {
  return async function request<S extends z.ZodType>(
    path: string,
    { method = 'GET', body, query, schema, signal }: RequestOptions<S>,
  ): Promise<z.output<S>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetchFn(buildUrl(baseUrl, path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      // A cancelled request is not a failure: let the caller recognise it as an AbortError and ignore it.
      if (isAbortError(err)) throw err;
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', {
        cause: err,
      });
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const errorBody = apiErrorBodySchema.safeParse(payload);
      const error = errorBody.success
        ? new ApiError(response.status, errorBody.data.error.code, errorBody.data.error.message)
        : new ApiError(response.status, 'HTTP_ERROR', `Request failed with status ${response.status}.`);
      // Only UNAUTHORIZED means "your session is no longer valid". INVALID_CREDENTIALS (wrong password at login) is also
      // a 401, but it is a normal form error and must not log anyone out.
      if (error.status === 401 && error.code === 'UNAUTHORIZED') onUnauthorized();
      throw error;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(response.status, 'BAD_RESPONSE', 'The server sent an unexpected response.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  };
}

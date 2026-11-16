import { createRequest } from './client';
import { createEndpoints, type Endpoints } from './endpoints';

export type CreateApiOptions = {
  baseUrl: string;
  // Called on every request. Returning null means "not logged in" and no Authorization header is sent.
  getToken: () => string | null;
  // Called first when the server answers 401 UNAUTHORIZED (token expired, or its user was deleted): the app forgets the
  // token here. Storage is the app's business, so it is injected rather than done in this package.
  onUnauthorized: () => void;
  // Injectable for tests; defaults to the browser's fetch.
  fetchFn?: typeof fetch;
};

export type CreateApiResult = {
  api: Endpoints;
  // The AuthProvider registers what should happen after onUnauthorized (log out in the UI and go to /login).
  setSessionExpiredHandler: (handler: (() => void) | null) => void;
};

// The one API object the app uses. The server answered 401 UNAUTHORIZED, so the token is useless: forget it first
// (onUnauthorized), then let the app react (the session-expired handler).
export function createApi({ baseUrl, getToken, onUnauthorized, fetchFn }: CreateApiOptions): CreateApiResult {
  let sessionExpiredHandler: (() => void) | null = null;

  const api = createEndpoints(
    createRequest({
      baseUrl,
      getToken,
      onUnauthorized: () => {
        onUnauthorized();
        sessionExpiredHandler?.();
      },
      fetchFn,
    }),
  );

  return {
    api,
    setSessionExpiredHandler: (handler) => {
      sessionExpiredHandler = handler;
    },
  };
}

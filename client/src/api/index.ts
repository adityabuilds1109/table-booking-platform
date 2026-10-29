import { tokenStore } from '../auth/tokenStore';
import { env } from '../lib/env';
import { createRequest } from './client';
import { createEndpoints } from './endpoints';

// The AuthProvider registers what should happen when the session turns out to be invalid (see AuthProvider.tsx).
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

// The one API object the app uses. The server answered 401 UNAUTHORIZED (token expired, or its user was deleted), so the
// token is useless: forget it first, then let the app react (log out in the UI and send the user to /login).
export const api = createEndpoints(
  createRequest({
    baseUrl: env.apiUrl,
    getToken: tokenStore.get,
    onUnauthorized: () => {
      tokenStore.clear();
      sessionExpiredHandler?.();
    },
  }),
);

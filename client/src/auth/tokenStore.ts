// Where the login token (JWT) lives, and the trade-offs, in short:
//  - localStorage (chosen): survives reloads and is shared by tabs, which is what users expect. Unlike a cookie it is only
//    sent by our own code, so there is no CSRF risk. The cost: any script running on the page can read it, so one XSS bug
//    would leak the token. We limit that by never rendering untrusted HTML, keeping tokens short-lived (1 hour, set by the
//    server) and sending the token only to the API.
//  - sessionStorage would log users out per tab; memory-only would log them out on every reload; an httpOnly cookie hides
//    the token from scripts but needs server work (Set-Cookie, CSRF protection, credentialed CORS).
// Everything that touches the token goes through this file, so changing the storage later means changing only this file.

const STORAGE_KEY = 'tbp.token';

// Browsers can make localStorage throw (blocked site data, some private modes). Probe once at startup; if it is unusable,
// the token lives in memory instead (the user stays logged in until the page is reloaded).
function storageAvailable(): boolean {
  try {
    const probe = '__tbp_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const useStorage = storageAvailable();
let memoryToken: string | null = null;

export const tokenStore = {
  get: (): string | null => (useStorage ? window.localStorage.getItem(STORAGE_KEY) : memoryToken),

  set: (token: string): void => {
    if (useStorage) window.localStorage.setItem(STORAGE_KEY, token);
    else memoryToken = token;
  },

  clear: (): void => {
    if (useStorage) window.localStorage.removeItem(STORAGE_KEY);
    else memoryToken = null;
  },

  // Calls `listener` when ANOTHER tab logs in or out (the browser's "storage" event never fires in the tab that made the
  // change). Returns a function that stops listening. Changes made in this tab are handled by the code that makes them.
  onChangeInOtherTab: (listener: () => void): (() => void) => {
    const handler = (event: StorageEvent) => {
      // event.key is null when another tab called localStorage.clear().
      if (event.storageArea === window.localStorage && (event.key === STORAGE_KEY || event.key === null)) listener();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },
};

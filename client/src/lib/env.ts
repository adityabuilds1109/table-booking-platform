import { parseApiUrl } from './apiUrl';

// Validated once, when the app loads: a missing or malformed VITE_API_URL fails immediately with a readable message
// instead of as a confusing network error on the first request. Vite only exposes variables that start with VITE_,
// and everything it exposes ends up in the browser bundle, so nothing secret belongs here.
export const env = {
  apiUrl: parseApiUrl(import.meta.env.VITE_API_URL),
};

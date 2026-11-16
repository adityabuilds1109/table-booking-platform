import { z } from 'zod';

const MISSING = 'VITE_API_URL is not set. Copy client/.env.example to client/.env and restart the dev server.';
const INVALID =
  'VITE_API_URL must be an http(s) URL such as http://localhost:4000 (no query string, fragment or credentials).';

function isPlainHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === ''
  );
}

const apiUrlSchema = z
  .string({ error: MISSING })
  .trim()
  .min(1, MISSING)
  .refine(isPlainHttpUrl, INVALID)
  // "http://localhost:4000/" and "http://localhost:4000" must behave the same, so paths can be appended as "/bookings".
  .transform((url) => url.replace(/\/+$/, ''));

// Kept apart from env.ts (which reads Vite's import.meta.env) so it can be run and tested without Vite.
export function parseApiUrl(value: unknown): string {
  const result = apiUrlSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? INVALID);
  }
  return result.data;
}

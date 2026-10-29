import type { Location } from 'react-router';
import { z } from 'zod';

// What we pass along (in the router's navigation state) when sending someone to /login, so they come back afterwards.
// It is read back through a schema because navigation state is `unknown`, and `from` must be an in-app path: a value
// like "//evil.example" would turn the post-login redirect into an open redirect to another site.
const loginStateSchema = z.object({
  from: z
    .string()
    .startsWith('/')
    .refine((path) => !path.startsWith('//') && !path.includes('\\'), 'from must be a path inside this app')
    .optional(),
  expired: z.boolean().optional(),
});

export type LoginState = z.output<typeof loginStateSchema>;

const AUTH_PAGES = ['/login', '/register'];

export function loginStateFor(location: Pick<Location, 'pathname' | 'search' | 'hash'>, expired = false): LoginState {
  // Coming back to /login or /register after logging in would loop, so those are never remembered.
  const isAuthPage = AUTH_PAGES.includes(location.pathname);
  return {
    ...(isAuthPage ? {} : { from: `${location.pathname}${location.search}${location.hash}` }),
    ...(expired ? { expired: true } : {}),
  };
}

export function readLoginState(state: unknown): LoginState {
  const parsed = loginStateSchema.safeParse(state);
  return parsed.success ? parsed.data : {};
}

// Where to go once logged in: back to the page they wanted, or the home page.
export function pathAfterLogin(state: unknown): string {
  const { from } = readLoginState(state);
  const path = from?.split(/[?#]/)[0] ?? '';
  return from !== undefined && !AUTH_PAGES.includes(path) ? from : '/';
}

import type { Role } from '../generated/prisma/client';

// Declaration merging: adds `user` to Express's own Request interface, so every handler sees it typed.
// Set by the `authenticate` middleware; undefined on routes that don't use it.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: Role };
    }
  }
}

// The import above makes this file a module, which is why the augmentation needs `declare global`.
export {};

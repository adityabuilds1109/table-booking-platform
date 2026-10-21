import jwt from 'jsonwebtoken';
import type { Role } from '../generated/prisma/client';
import { config } from '../config';

// `sub` carries the user id; role is included for convenience, but the auth middleware (step 4) re-reads it from the DB.
export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
  });
}

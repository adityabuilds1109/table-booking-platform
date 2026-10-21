import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../errors';
import { Role } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

function unauthorized(): AppError {
  return new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authentication token');
}

// Requires `Authorization: Bearer <token>` and sets req.user.
// jwt.verify throws JsonWebTokenError (incl. TokenExpiredError) on a bad token; the central error handler maps it to 401.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token, ...rest] = (req.headers.authorization ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    throw unauthorized();
  }

  // Pinning the algorithm stops a token from choosing its own (e.g. "none") in its header.
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw unauthorized();
  }

  // Read from the DB instead of trusting the token's role claim, so a deleted user or a
  // changed role takes effect immediately rather than when the token expires.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    throw unauthorized();
  }

  req.user = user;
  next();
};

// Use after `authenticate`. The 401 branch only fires if that order is ever broken.
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw unauthorized();
  }
  if (req.user.role !== Role.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  next();
};

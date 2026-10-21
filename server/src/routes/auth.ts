import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../auth/schemas';
import { signToken } from '../auth/token';
import { config } from '../config';
import { AppError } from '../errors';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate, type ValidatedRequest } from '../middleware/validate';

// Compared against when the email is unknown, so "no such user" costs the same bcrypt time as
// "wrong password" and response timing doesn't reveal which emails exist. Built once at startup
// with the configured cost (hashSync blocks briefly, which is fine before the server accepts requests).
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), config.bcryptCost);

const router = Router();

router.post('/register', validate(registerSchema), async (req: ValidatedRequest<RegisterInput>, res) => {
  const { email, password, name } = req.body;
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);

  // role is never read from the request, so clients can't self-register as ADMIN.
  // A duplicate email is rejected by the unique index (P2002 -> 409 EMAIL_TAKEN in the error handler),
  // which avoids a check-then-insert race.
  const user = await prisma.user.create({ data: { email, passwordHash, name } });

  res.status(201).json({
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post('/login', validate(loginSchema), async (req: ValidatedRequest<LoginInput>, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run compare, and use one identical error for both failure cases.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get('/me', authenticate, (req, res) => {
  // authenticate always sets req.user, but its type is optional, so narrow it instead of using `!`.
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authentication token');
  }
  res.json({ user: req.user });
});

export default router;

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { z } from 'zod';
import { signToken } from '../auth/token';
import app from '../app';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { disconnectDatabase, resetDatabase } from '../test/db';

// supertest types res.body as `any`; parsing it with Zod gives each test a typed value and checks the shape.
const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({ id: z.string(), email: z.string(), name: z.string(), role: z.enum(['USER', 'ADMIN']) }),
});
const meResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string(), role: z.enum(['USER', 'ADMIN']) }),
});

const PASSWORD = 'correct-horse-battery';
const UNAUTHORIZED = { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token' } };

// Same values src/test/setupEnv.ts put into process.env, read back so tests can sign their own tokens.
const jwtSecret = process.env.JWT_SECRET ?? '';

async function registerUser(email = 'diner@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: PASSWORD, name: 'Test Diner' });
  return { res, ...(res.status === 201 ? authResponseSchema.parse(res.body) : {}) };
}

async function registerAndGetSession(email = 'diner@example.com') {
  const { res, token, user } = await registerUser(email);
  if (res.status !== 201 || !token || !user) {
    throw new Error(`Arrange step failed: register returned ${res.status}`);
  }
  return { token, user };
}

function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('POST /auth/register', () => {
  it('creates a USER account and returns a token without exposing the password hash', async () => {
    // Act
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: PASSWORD, name: 'New Diner' });

    // Assert
    expect(res.status).toBe(201);
    const body = authResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: 'new@example.com', name: 'New Diner', role: 'USER' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password/i);
  });

  it('ignores a role sent by the client', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'sneaky@example.com', password: PASSWORD, name: 'Sneaky', role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(authResponseSchema.parse(res.body).user.role).toBe('USER');
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN, even when the case differs', async () => {
    // Arrange
    await registerAndGetSession('dupe@example.com');

    // Act
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'DUPE@Example.com', password: PASSWORD, name: 'Second' });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
    });
  });

  it('rejects a too-short password with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'short@example.com', password: 'short', name: 'Short' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('POST /auth/login', () => {
  it('returns a token and the user for correct credentials', async () => {
    // Arrange
    const { user } = await registerAndGetSession('login@example.com');

    // Act
    const res = await request(app).post('/auth/login').send({ email: 'login@example.com', password: PASSWORD });

    // Assert
    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.id).toBe(user.id);
  });

  it('gives the identical 401 INVALID_CREDENTIALS for a wrong password and an unknown email', async () => {
    // Arrange
    await registerAndGetSession('known@example.com');

    // Act
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'known@example.com', password: 'not-the-password' });
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    // Assert
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('GET /auth/me', () => {
  it('returns id, email and role for a valid token', async () => {
    // Arrange
    const { token, user } = await registerAndGetSession();

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(token));

    // Assert
    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body)).toEqual({
      user: { id: user.id, email: user.email, role: 'USER' },
    });
  });

  it('returns 401 UNAUTHORIZED with no Authorization header', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for a header that is not a Bearer token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer('this.is.garbage'));

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    // Arrange
    const { user } = await registerAndGetSession();
    const forged = jwt.sign({}, 'a-completely-different-secret-of-32-chars!!', { algorithm: 'HS256', subject: user.id });

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(forged));

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for a token signed with the right secret but a different algorithm (HS512)', async () => {
    // Arrange: proves the HS256-only pin, not just signature checking.
    const { user } = await registerAndGetSession();
    const wrongAlgorithm = jwt.sign({}, jwtSecret, { algorithm: 'HS512', subject: user.id });

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(wrongAlgorithm));

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for an unsigned token that claims alg "none"', async () => {
    // Arrange
    const { user } = await registerAndGetSession();
    const unsigned = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: user.id })}.`;

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(unsigned));

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for an expired token', async () => {
    // Arrange
    const { user } = await registerAndGetSession();
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret, {
      algorithm: 'HS256',
      subject: user.id,
    });

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(expired));

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 for a validly signed token that has no subject', async () => {
    const noSubject = jwt.sign({ role: 'ADMIN' }, jwtSecret, { algorithm: 'HS256' });

    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(noSubject));

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 401 once the user has been deleted, even though the token is still valid', async () => {
    // Arrange
    const { token, user } = await registerAndGetSession();
    await prisma.user.delete({ where: { id: user.id } });

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(token));

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('reports the role from the database, not the role claim inside the token', async () => {
    // Arrange: the token was signed while the user was a USER.
    const { token, user } = await registerAndGetSession();
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    // Act
    const res = await request(app)
      .get('/auth/me')
      .set(...bearer(token));

    // Assert
    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body).user.role).toBe('ADMIN');
  });
});

// No admin routes exist yet, so requireAdmin is tested on a throwaway app wired like the real ones will be.
describe('requireAdmin', () => {
  const adminApp = express();
  adminApp.get('/admin-only', authenticate, requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });
  adminApp.use(errorHandler);

  it('returns 401 with no token', async () => {
    const res = await request(adminApp).get('/admin-only');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('returns 403 FORBIDDEN for a USER', async () => {
    // Arrange
    const { token } = await registerAndGetSession();

    // Act
    const res = await request(adminApp)
      .get('/admin-only')
      .set(...bearer(token));

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  });

  it('applies a role change immediately, in both directions, with the same token', async () => {
    // Arrange
    const { token, user } = await registerAndGetSession();

    // Act + Assert: promote
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    const asAdmin = await request(adminApp)
      .get('/admin-only')
      .set(...bearer(token));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toEqual({ ok: true });

    // Act + Assert: demote
    await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    const demoted = await request(adminApp)
      .get('/admin-only')
      .set(...bearer(token));
    expect(demoted.status).toBe(403);
  });

  it('ignores an ADMIN role claim inside a token whose user is only a USER', async () => {
    // Arrange: hand-built token that lies about the role.
    const { user } = await registerAndGetSession();
    const lyingToken = jwt.sign({ role: 'ADMIN' }, jwtSecret, { algorithm: 'HS256', subject: user.id });

    // Act
    const res = await request(adminApp)
      .get('/admin-only')
      .set(...bearer(lyingToken));

    // Assert
    expect(res.status).toBe(403);
  });
});

describe('signToken', () => {
  it('produces an HS256 token whose subject is the user id', () => {
    const token = signToken({ id: 'user-123', role: 'USER' });

    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({ sub: 'user-123' });
  });
});

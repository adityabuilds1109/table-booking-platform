import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../app';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { authHeaderFor, createUser } from '../test/factories';

// src/test/setupEnv.ts sets CORS_ORIGINS to these two (with a stray space that the parser trims).
const ALLOWED_ORIGINS = ['https://app.example.test', 'http://localhost:5173'];
const ALLOWED = ALLOWED_ORIGINS[0] ?? '';

// Origins that look close to an allowed one but must not match: CORS compares exact strings.
const DISALLOWED_ORIGINS: [string, string][] = [
  ['an unrelated site', 'https://evil.example'],
  ['the right host on the wrong port', 'http://localhost:5174'],
  ['the right host on the wrong scheme', 'http://app.example.test'],
  ['an allowed host as a prefix of a bad one', 'https://app.example.test.evil.com'],
  ['an allowed host as a subdomain of a bad one', 'https://evil.com/https://app.example.test'],
  ['the literal null origin (sandboxed pages, file://)', 'null'],
];

type Res = Awaited<ReturnType<ReturnType<typeof request>['get']>>;

function header(res: Res, name: string): string | undefined {
  const value = res.headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

function listOf(res: Res, name: string): string[] {
  return (header(res, name) ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function preflight(path: string, origin: string, method: string, requestHeaders = 'authorization,content-type') {
  return request(app)
    .options(path)
    .set('Origin', origin)
    .set('Access-Control-Request-Method', method)
    .set('Access-Control-Request-Headers', requestHeaders);
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('CORS: normal requests', () => {
  it.each(ALLOWED_ORIGINS)('echoes the allowed origin %s back, never "*"', async (origin) => {
    const res = await request(app).get('/health').set('Origin', origin);

    expect(res.status).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBe(origin);
    expect(header(res, 'access-control-allow-origin')).not.toBe('*');
  });

  it('tells caches the answer depends on the Origin header (Vary: Origin)', async () => {
    const res = await request(app).get('/health').set('Origin', ALLOWED);

    expect(listOf(res, 'vary')).toContain('origin');
  });

  it.each(DISALLOWED_ORIGINS)('gives %s no permission headers', async (_label, origin) => {
    const res = await request(app).get('/health').set('Origin', origin);

    // The server still answers (CORS is enforced by the browser, which discards the response); it just doesn't opt in.
    expect(res.status).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
    expect(header(res, 'access-control-allow-credentials')).toBeUndefined();
    // Still varies by Origin, so a shared cache can't serve this answer to an allowed origin.
    expect(listOf(res, 'vary')).toContain('origin');
  });

  it('sends no CORS headers when there is no Origin header (curl, server-to-server, same-origin)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
  });

  it('never allows credentials: the API uses a Bearer header, not cookies', async () => {
    const responses = [
      await request(app).get('/health').set('Origin', ALLOWED),
      await preflight('/bookings', ALLOWED, 'POST'),
      await request(app).get('/nope').set('Origin', ALLOWED),
      await request(app).get('/health').set('Origin', 'https://evil.example'),
    ];

    for (const res of responses) {
      expect(header(res, 'access-control-allow-credentials')).toBeUndefined();
    }
  });
});

describe('CORS: preflight (the browser asks first, for calls with an Authorization header or PATCH)', () => {
  it('answers POST /bookings with Authorization from an allowed origin: 204, origin, methods, headers', async () => {
    // Act: no token is sent, as in a real preflight.
    const res = await preflight('/bookings', ALLOWED, 'POST', 'authorization,content-type');

    // Assert
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
    expect(listOf(res, 'access-control-allow-methods')).toContain('post');
    expect(listOf(res, 'access-control-allow-headers')).toEqual(expect.arrayContaining(['authorization', 'content-type']));
    expect(header(res, 'access-control-max-age')).toBe('600');
  });

  it('is answered before authentication, so it is 204, not 401', async () => {
    const res = await preflight('/bookings/me', ALLOWED, 'GET', 'authorization');

    expect(res.status).toBe(204);
  });

  it('allows PATCH, which the cancel endpoint needs', async () => {
    const res = await preflight(`/bookings/${randomUUID()}/cancel`, ALLOWED, 'PATCH', 'authorization');

    expect(res.status).toBe(204);
    expect(listOf(res, 'access-control-allow-methods')).toContain('patch');
  });

  it('is answered even for a path that has no route (it runs before routing)', async () => {
    const res = await preflight('/no-such-route', ALLOWED, 'POST');

    expect(res.status).toBe(204);
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
  });

  it.each(DISALLOWED_ORIGINS)('grants %s nothing: no Access-Control-Allow-Origin', async (_label, origin) => {
    const res = await preflight('/bookings', origin, 'POST');

    // The `cors` package still lists the allowed methods/headers in this response, but without a matching
    // Access-Control-Allow-Origin the browser fails the preflight and ignores them, so Allow-Origin is the header
    // that decides. (Checked against the real responses: the lists are present, the origin header is not.)
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
    expect(header(res, 'access-control-allow-credentials')).toBeUndefined();
  });

  it('lists exactly the methods the API uses, so DELETE and PUT are not granted', async () => {
    const res = await preflight('/bookings', ALLOWED, 'DELETE');

    expect([...listOf(res, 'access-control-allow-methods')].sort()).toEqual(['get', 'patch', 'post']);
  });

  it('lists exactly the headers the API uses, so an arbitrary custom header is not granted', async () => {
    const res = await preflight('/bookings', ALLOWED, 'POST', 'authorization,content-type,x-custom-header');

    expect([...listOf(res, 'access-control-allow-headers')].sort()).toEqual(['authorization', 'content-type']);
  });
});

describe('CORS: error responses are readable by the browser app too', () => {
  it('adds the header to a 401, so the app can read the error code', async () => {
    const res = await request(app).post('/bookings').set('Origin', ALLOWED).send({});

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
  });

  it('adds the header to a 404', async () => {
    const res = await request(app).get('/no-such-route').set('Origin', ALLOWED);

    expect(res.status).toBe(404);
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
  });

  it('adds the header to a 400 for malformed JSON, which fails inside the body parser', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Origin', ALLOWED)
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
  });

  it('adds the header to a successful authenticated request', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/bookings/me')
      .set(...authHeaderFor(user))
      .set('Origin', ALLOWED);

    expect(res.status).toBe(200);
    expect(header(res, 'access-control-allow-origin')).toBe(ALLOWED);
  });

  it('adds nothing to a 401 for a disallowed origin', async () => {
    const res = await request(app).post('/bookings').set('Origin', 'https://evil.example').send({});

    expect(res.status).toBe(401);
    expect(header(res, 'access-control-allow-origin')).toBeUndefined();
  });
});

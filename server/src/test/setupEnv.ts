// Jest runs this before every test file (jest.config.js -> setupFiles), before any app module is imported.
// Order matters: src/lib/prisma.ts reads DATABASE_URL and src/config.ts reads the JWT/bcrypt settings the
// moment they are imported, so everything has to be in process.env first.
import 'dotenv/config'; // lets TEST_DATABASE_URL live in server/.env locally; CI just exports it
import { assertTestDatabaseUrl } from './assertTestDatabase';

const testDatabaseUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');

// Point the app at the test database. dotenv never overrides variables that are already set,
// so the DATABASE_URL in server/.env cannot win over this.
process.env.DATABASE_URL = testDatabaseUrl;

// Fixed values so tests never use the real secret. Not secrets themselves.
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
// Lowest allowed cost: bcrypt is deliberately slow, and tests hash a lot.
process.env.BCRYPT_COST = '4';

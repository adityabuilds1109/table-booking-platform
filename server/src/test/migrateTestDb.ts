// `npm run test:db:migrate`: applies the committed migrations (including the hand-written constraints)
// to the test database. Run with tsx so it can share the guard with the Jest setup.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { assertTestDatabaseUrl } from './assertTestDatabase';

const testDatabaseUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');

// prisma.config.ts reads DATABASE_URL, so hand the test URL to the Prisma CLI under that name.
// `shell` is needed on Windows, where npx is a .cmd file.
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

process.exitCode = result.status ?? 1;

// Plain CommonJS on purpose: a jest.config.ts would need the extra `ts-node` package just to be read.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Runs before every test file, before any app code is imported (see src/test/setupEnv.ts for why that matters).
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
};

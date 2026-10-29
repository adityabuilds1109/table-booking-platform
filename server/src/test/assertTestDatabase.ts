// Tests wipe tables, so they must never run against the development database.
// The rule is deliberately dumb and strict: the database name has to end in "_test".
const TEST_DATABASE_SUFFIX = '_test';

// Returns the URL if it is safe, otherwise throws. Error messages name only the variable and the database
// name, never the full URL, because the URL contains the password.
export function assertTestDatabaseUrl(rawUrl: string | undefined, variableName: string): string {
  if (!rawUrl) {
    throw new Error(`${variableName} is not set. Tests need a dedicated database whose name ends in "${TEST_DATABASE_SUFFIX}".`);
  }
  if (!URL.canParse(rawUrl)) {
    throw new Error(`${variableName} is not a valid URL`);
  }

  const url = new URL(rawUrl);
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${variableName} must be a postgresql:// URL`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run tests: ${variableName} points at database "${databaseName}", ` +
        `but test database names must end in "${TEST_DATABASE_SUFFIX}".`,
    );
  }

  return rawUrl;
}

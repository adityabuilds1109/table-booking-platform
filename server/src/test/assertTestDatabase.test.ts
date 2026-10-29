import { assertTestDatabaseUrl } from './assertTestDatabase';

const VARIABLE = 'TEST_DATABASE_URL';

describe('assertTestDatabaseUrl', () => {
  it.each([
    'postgresql://booking:secret@localhost:5432/booking_test',
    'postgres://u:p@db.example.com/app_test?schema=public',
    'postgresql://u:p@localhost/ci_test',
  ])('accepts %s', (url) => {
    expect(assertTestDatabaseUrl(url, VARIABLE)).toBe(url);
  });

  it.each([
    ['the development database', 'postgresql://booking:secret@localhost:5432/booking'],
    ['a name that merely contains test', 'postgresql://u:p@localhost/test_data'],
    ['a name that does not end in _test', 'postgresql://u:p@localhost/booking_test_old'],
    ['a name with test but no underscore', 'postgresql://u:p@localhost/booking-test'],
    ['no database name', 'postgresql://u:p@localhost:5432'],
  ])('rejects %s', (_label, url) => {
    expect(() => assertTestDatabaseUrl(url, VARIABLE)).toThrow(/test database names must end in "_test"/);
  });

  it('rejects a missing value', () => {
    expect(() => assertTestDatabaseUrl(undefined, VARIABLE)).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it('rejects a non-postgres URL', () => {
    expect(() => assertTestDatabaseUrl('mysql://u:p@localhost/app_test', VARIABLE)).toThrow(/postgresql:\/\//);
  });

  it('rejects text that is not a URL', () => {
    expect(() => assertTestDatabaseUrl('not a url', VARIABLE)).toThrow(/not a valid URL/);
  });

  it('never puts the password in an error message', () => {
    const check = () => assertTestDatabaseUrl('postgresql://booking:hunter2@localhost/booking', VARIABLE);

    expect(check).toThrow(/Refusing to run tests/); // it does throw...
    expect(check).not.toThrow(/hunter2/); // ...but the message carries no password
  });
});

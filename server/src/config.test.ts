import { config, corsOriginsSchema } from './config';

describe('corsOriginsSchema', () => {
  it('parses a single origin', () => {
    expect(corsOriginsSchema.parse('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('parses a comma-separated list and trims spaces around each entry', () => {
    const parsed = corsOriginsSchema.parse(' https://app.example.com ,http://localhost:5173,  https://admin.example.com:8443 ');

    expect(parsed).toEqual(['https://app.example.com', 'http://localhost:5173', 'https://admin.example.com:8443']);
  });

  it('ignores empty entries, such as a trailing comma', () => {
    expect(corsOriginsSchema.parse('https://app.example.com,')).toEqual(['https://app.example.com']);
  });

  it.each([
    ['a wildcard', '*'],
    ['a wildcard among valid origins', 'https://app.example.com,*'],
    ['a wildcard subdomain', 'https://*.example.com'],
    ['a trailing slash', 'https://app.example.com/'],
    ['a path', 'https://app.example.com/app'],
    ['a query string', 'https://app.example.com?x=1'],
    ['a missing scheme', 'app.example.com'],
    ['a default port written out', 'https://app.example.com:443'],
    ['a non-web scheme', 'ftp://app.example.com'],
    ['the literal string null', 'null'],
    ['credentials in the URL', 'https://user:pw@app.example.com'],
  ])('rejects %s', (_label, value) => {
    expect(corsOriginsSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ['an empty string', ''],
    ['only commas and spaces', ' , ,'],
  ])('rejects %s, because an empty allow-list is almost certainly a mistake', (_label, value) => {
    const result = corsOriginsSchema.safeParse(value);

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('at least one origin');
  });

  it('names the problem when an origin is invalid', () => {
    const result = corsOriginsSchema.safeParse('https://app.example.com/');

    expect(JSON.stringify(result.error?.issues)).toContain('scheme://host[:port]');
  });
});

describe('config.corsOrigins', () => {
  it('comes from CORS_ORIGINS, parsed and trimmed (set by src/test/setupEnv.ts)', () => {
    expect(config.corsOrigins).toEqual(['https://app.example.test', 'http://localhost:5173']);
  });
});

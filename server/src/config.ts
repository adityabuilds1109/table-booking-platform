import 'dotenv/config';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

// jsonwebtoken only accepts `number | StringValue` (ms's "1h"-style template type) for expiresIn.
// Deriving the type from SignOptions avoids importing a transitive dependency (`ms`) directly.
type JwtExpiresIn = Exclude<NonNullable<SignOptions['expiresIn']>, number>;

// A unit is required: jsonwebtoken reads a bare numeric string like "3600" as milliseconds.
const DURATION = /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y|secs?|mins?|hrs?|yrs?|seconds?|minutes?|hours?|days?|weeks?|years?)$/i;

// An origin is scheme + host + optional port, exactly as a browser sends it in the Origin header
// ("https://app.example.com", "http://localhost:5173"). Round-tripping through URL rejects everything that isn't one:
// a path, a trailing slash, a default port written out, and non-web schemes. "*" is checked separately because the URL
// parser accepts it inside a host name ("https://*.example.com"), and origins are matched as exact strings, so a
// wildcard entry would never match anything while looking as if it worked.
function isExactWebOrigin(value: string): boolean {
  if (value.includes('*') || !URL.canParse(value)) return false;
  const url = new URL(value);
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
}

// CORS_ORIGINS="https://app.example.com, http://localhost:5173". Exported so the parsing rules can be tested directly.
// An empty list is an error, not "allow nobody": it is far more likely a mistake than a choice.
export const corsOriginsSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z
      .array(
        z
          .string()
          .refine(
            isExactWebOrigin,
            'each origin must be exactly scheme://host[:port] with no wildcard, path or trailing slash',
          ),
      )
      .min(1, 'CORS_ORIGINS must list at least one origin'),
  );

// Parsed once at startup so a bad or missing value fails fast, not on the first login.
const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .refine((value) => !value.startsWith('change-me'), {
        message: 'JWT_SECRET is still the .env.example placeholder; set a real random secret',
      }),
    // z.custom narrows the string to JwtExpiresIn through a runtime check, so no cast is needed.
    JWT_EXPIRES_IN: z
      .custom<JwtExpiresIn>((value) => typeof value === 'string' && DURATION.test(value), {
        message: 'JWT_EXPIRES_IN must be a duration with a unit, e.g. 15m, 1h, 7d',
      })
      .default('1h'),
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
    // Browser origins allowed to call this API (CORS). The default is the Vite dev server.
    CORS_ORIGINS: corsOriginsSchema.default(['http://localhost:5173']),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.BCRYPT_COST >= 10, {
    path: ['BCRYPT_COST'],
    message: 'BCRYPT_COST must be at least 10 in production',
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const config = {
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  bcryptCost: parsed.data.BCRYPT_COST,
  corsOrigins: parsed.data.CORS_ORIGINS,
};

import 'dotenv/config';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

// jsonwebtoken only accepts `number | StringValue` (ms's "1h"-style template type) for expiresIn.
// Deriving the type from SignOptions avoids importing a transitive dependency (`ms`) directly.
type JwtExpiresIn = Exclude<NonNullable<SignOptions['expiresIn']>, number>;

// A unit is required: jsonwebtoken reads a bare numeric string like "3600" as milliseconds.
const DURATION = /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y|secs?|mins?|hrs?|yrs?|seconds?|minutes?|hours?|days?|weeks?|years?)$/i;

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
};

import 'dotenv/config';
import { z } from 'zod';

// Parsed once at startup so a bad or missing value fails fast, not on the first login.
const envSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((value) => !value.startsWith('change-me'), {
      message: 'JWT_SECRET is still the .env.example placeholder; set a real random secret',
    }),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
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

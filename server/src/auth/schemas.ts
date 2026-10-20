import { z } from 'zod';

// One definition so register and login can never normalize emails differently.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// bcrypt only uses the first 72 BYTES, so a longer password would silently be truncated.
// Counting bytes (not characters) matters because multi-byte characters use more than one.
const password = z
  .string()
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes');

export const registerSchema = z.object({
  email,
  password: password.pipe(z.string().min(8, 'Password must be at least 8 characters')),
  name: z.string().trim().min(1).max(100),
});

// No minimum-length rule on login: the password was checked when it was set, and the
// response to a wrong one must look the same whatever its length.
export const loginSchema = z.object({
  email,
  password: password.pipe(z.string().min(1)),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;

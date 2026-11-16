import { z } from 'zod';

// The login and registration rules, written to accept and reject exactly what the server's schemas do
// (server/src/auth/schemas.ts). Only the wording differs: these messages are written for people. The client cannot
// import the server's file (separate packages), so `npm run check:schema-parity` compares the two on hundreds of inputs.
// If you change a rule here or on the server, run it.

const MAX_EMAIL_LENGTH = 254;
// bcrypt only uses the first 72 BYTES of a password, and the server rejects longer ones instead of silently truncating.
const MAX_PASSWORD_BYTES = 72;
const MIN_NEW_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

const messages = {
  emailRequired: 'Enter your email address.',
  emailInvalid: 'Enter a valid email address, like name@example.com.',
  emailTooLong: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
  passwordRequired: 'Enter your password.',
  passwordTooLong: `Password is too long: at most ${MAX_PASSWORD_BYTES} bytes (characters like € or emoji use more than one).`,
  newPasswordTooShort: `Password must be at least ${MIN_NEW_PASSWORD_LENGTH} characters.`,
  nameRequired: 'Enter your name.',
  nameTooLong: `Name must be ${MAX_NAME_LENGTH} characters or fewer.`,
} as const;

const utf8Length = (value: string): number => new TextEncoder().encode(value).length;

// Trimmed and lower-cased exactly like the server does, so "  Ann@Example.COM " and "ann@example.com" are one account.
// `.pipe()` runs the format checks only when the "not empty" check passed, so a field never shows two messages at once.
const email = z
  .string({ error: messages.emailRequired })
  .trim()
  .min(1, messages.emailRequired)
  .toLowerCase()
  .pipe(z.email(messages.emailInvalid).max(MAX_EMAIL_LENGTH, messages.emailTooLong));

// Not trimmed: spaces are legitimate password characters.
const passwordWithinByteLimit = z
  .string({ error: messages.passwordRequired })
  .refine((value) => utf8Length(value) <= MAX_PASSWORD_BYTES, messages.passwordTooLong);

// No minimum length on login (server rule): it must not reveal the password policy, and old passwords stay valid.
export const loginFormSchema = z.object({
  email,
  password: passwordWithinByteLimit.pipe(z.string().min(1, messages.passwordRequired)),
});

export const registerFormSchema = z.object({
  email,
  password: passwordWithinByteLimit.pipe(z.string().min(MIN_NEW_PASSWORD_LENGTH, messages.newPasswordTooShort)),
  name: z
    .string({ error: messages.nameRequired })
    .trim()
    .min(1, messages.nameRequired)
    .max(MAX_NAME_LENGTH, messages.nameTooLong),
});

export type LoginFormValues = z.input<typeof loginFormSchema>;
export type LoginFormData = z.output<typeof loginFormSchema>;
export type RegisterFormValues = z.input<typeof registerFormSchema>;
export type RegisterFormData = z.output<typeof registerFormSchema>;

export type LoginFieldErrors = { email?: string; password?: string };
export type RegisterFieldErrors = { email?: string; password?: string; name?: string };

export type ValidationResult<Data, Errors> = { ok: true; data: Data } | { ok: false; errors: Errors };

// The first message for each field. Several checks can fail at once on one field; showing only the first keeps each
// field to a single, actionable sentence.
function firstMessageByField(error: z.ZodError): ReadonlyMap<string, string> {
  const firstIssues = error.issues.filter(
    (issue, index) => error.issues.findIndex((other) => other.path[0] === issue.path[0]) === index,
  );
  return new Map(
    firstIssues.flatMap((issue) => (typeof issue.path[0] === 'string' ? [[issue.path[0], issue.message] as const] : [])),
  );
}

export function validateLogin(values: LoginFormValues): ValidationResult<LoginFormData, LoginFieldErrors> {
  const result = loginFormSchema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const byField = firstMessageByField(result.error);
  return { ok: false, errors: { email: byField.get('email'), password: byField.get('password') } };
}

export function validateRegister(values: RegisterFormValues): ValidationResult<RegisterFormData, RegisterFieldErrors> {
  const result = registerFormSchema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const byField = firstMessageByField(result.error);
  return {
    ok: false,
    errors: { email: byField.get('email'), password: byField.get('password'), name: byField.get('name') },
  };
}

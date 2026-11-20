import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '@table-booking/shared/api';
import { describeAuthError, type AuthFeedback } from '@table-booking/shared/auth';
import { validateRegister, type RegisterFieldErrors } from '@table-booking/shared/auth';
import { readLoginState } from '../auth/loginRedirect';
import { useAuth } from '../auth/useAuth';
import AuthLayout, { AUTH_ERROR_BOX_CLASS, AUTH_LINK_CLASS, AUTH_SUBMIT_CLASS } from '../components/AuthLayout';
import TextField from '../components/TextField';

type Field = 'name' | 'email' | 'password';
// The order the fields appear on the page: focus goes to the first invalid one in this order.
const FIELD_ORDER: readonly Field[] = ['name', 'email', 'password'];

export default function Register() {
  const { register } = useAuth();
  const location = useLocation();
  const { from } = readLoginState(location.state);

  const [values, setValues] = useState({ name: '', email: '', password: '' });
  // False until the first submit attempt (see Login.tsx for the reasoning).
  const [submitted, setSubmitted] = useState(false);
  const [serverFeedback, setServerFeedback] = useState<AuthFeedback | null>(null);
  const [pending, setPending] = useState(false);
  // A ref as well as state, so two submits in the same instant (before React re-renders) cannot both go through.
  const pendingRef = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { name: nameRef, email: emailRef, password: passwordRef };

  const validation = validateRegister(values);
  const clientErrors: RegisterFieldErrors = submitted && !validation.ok ? validation.errors : {};
  const nameError = clientErrors.name ?? serverFeedback?.fieldErrors.name;
  const emailError = clientErrors.email ?? serverFeedback?.fieldErrors.email;
  const passwordError = clientErrors.password ?? serverFeedback?.fieldErrors.password;

  // "Log in instead" is offered only while the email error on screen is the server's "already registered" one.
  const showLoginInstead =
    serverFeedback?.offerLogin === true && emailError !== undefined && emailError === serverFeedback.fieldErrors.email;

  // Both links to the login page keep the page the person was originally trying to reach.
  const loginState = from === undefined ? undefined : { from };

  function changeField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Editing a field withdraws what the server said about it; the form-level message stays until the next submit.
    setServerFeedback((current) =>
      current === null ? null : { ...current, fieldErrors: { ...current.fieldErrors, [field]: undefined } },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    setSubmitted(true);
    setServerFeedback(null);

    const result = validateRegister(values);
    if (!result.ok) {
      // Focus the first field with a problem; its hint and error are part of its accessible description.
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field] !== undefined) ?? 'name';
      fieldRefs[firstInvalid].current?.focus();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    try {
      await register(result.data);
      // Success: the new account is logged in and GuestOnly redirects to the page the person wanted (or home).
    } catch (error: unknown) {
      pendingRef.current = false;
      setPending(false);
      // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
      if (!(error instanceof ApiError)) throw error;
      const feedback = describeAuthError(error);
      setServerFeedback(feedback);
      if (feedback.focus) fieldRefs[feedback.focus].current?.focus();
    }
  }

  return (
    <AuthLayout
      eyebrow="Join us"
      sentence="Create an account to reserve a table and manage your bookings."
    >
      <section>
        <title>Create an account – Table Booking</title>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-[-0.03em]">Create an account</h1>
        <p className="mt-2 flex min-h-11 flex-wrap items-center gap-x-1 text-body">
          Already have an account?{' '}
          <Link to="/login" state={loginState} className={AUTH_LINK_CLASS}>
            Log in
          </Link>
        </p>
        <p className="mt-4 text-muted">All fields are required.</p>

        <form noValidate onSubmit={handleSubmit} aria-busy={pending} className="mt-6 space-y-5">
          <TextField
            ref={nameRef}
            label="Name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            value={values.name}
            onChange={(value) => changeField('name', value)}
            error={nameError}
          />
          <TextField
            ref={emailRef}
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            value={values.email}
            onChange={(value) => changeField('email', value)}
            error={emailError}
            errorAction={
              showLoginInstead && (
                <>
                  {' '}
                  <Link to="/login" state={loginState} className={AUTH_LINK_CLASS}>
                    Log in instead
                  </Link>
                </>
              )
            }
          />
          <TextField
            ref={passwordRef}
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            value={values.password}
            onChange={(value) => changeField('password', value)}
            error={passwordError}
          />

          {/* Always in the page (empty when there is no message), so screen readers announce text added to it. */}
          <div role="alert">
            {serverFeedback?.formMessage && (
              <p className={AUTH_ERROR_BOX_CLASS}>{serverFeedback.formMessage}</p>
            )}
          </div>

          <button type="submit" disabled={pending} className={AUTH_SUBMIT_CLASS}>
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}

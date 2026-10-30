import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../api/client';
import { describeAuthError, type AuthFeedback } from '../auth/authErrors';
import { validateLogin, type LoginFieldErrors } from '../auth/credentialSchemas';
import { readLoginState } from '../auth/loginRedirect';
import { useAuth } from '../auth/useAuth';
import TextField from '../components/TextField';

type Field = 'email' | 'password';

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const { expired, from } = readLoginState(location.state);

  const [values, setValues] = useState({ email: '', password: '' });
  // False until the first submit attempt, so a person is not told "Enter your email" before they have typed anything.
  // After that, errors are recomputed on every keystroke and disappear as soon as the value is fixed.
  const [submitted, setSubmitted] = useState(false);
  const [serverFeedback, setServerFeedback] = useState<AuthFeedback | null>(null);
  const [pending, setPending] = useState(false);
  // A ref as well as state: state updates lag a render, and a fast double Enter must not send two requests.
  const pendingRef = useRef(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fieldRefs = { email: emailRef, password: passwordRef };

  const validation = validateLogin(values);
  const clientErrors: LoginFieldErrors = submitted && !validation.ok ? validation.errors : {};
  const emailError = clientErrors.email ?? serverFeedback?.fieldErrors.email;
  const passwordError = clientErrors.password ?? serverFeedback?.fieldErrors.password;

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

    const result = validateLogin(values);
    if (!result.ok) {
      // Focus the first field with a problem; its error is part of its accessible description, so it is read out.
      const firstInvalid: Field = result.errors.email ? 'email' : 'password';
      fieldRefs[firstInvalid].current?.focus();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    try {
      await login(result.data);
      // Success: the session is now authenticated and GuestOnly redirects to the page the person wanted (or home).
      // Nothing to reset here, the form is about to go away.
    } catch (error: unknown) {
      pendingRef.current = false;
      setPending(false);
      // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
      if (!(error instanceof ApiError)) throw error;
      const feedback = describeAuthError(error);
      setServerFeedback(feedback);
      if (feedback.focus === 'email' || feedback.focus === 'password') fieldRefs[feedback.focus].current?.focus();
    }
  }

  // "Create an account" keeps the page the person was originally trying to reach.
  const registerState = from === undefined ? undefined : { from };

  return (
    <section className="mx-auto max-w-md">
      <title>Log in – Table Booking</title>
      <h1 className="text-2xl font-bold">Log in</h1>
      {expired && (
        <p role="status" className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
          Your session has expired. Please log in again.
        </p>
      )}
      <p className="mt-2 text-slate-600">All fields are required.</p>

      <form noValidate onSubmit={handleSubmit} aria-busy={pending} className="mt-4 space-y-4">
        <TextField
          ref={emailRef}
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          value={values.email}
          onChange={(value) => changeField('email', value)}
          error={emailError}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(value) => changeField('password', value)}
          error={passwordError}
        />

        {/* Always in the page (empty when there is no message): screen readers announce text put into an existing alert region more reliably than a region that appears together with its text. */}
        <div role="alert">
          {serverFeedback?.formMessage && (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{serverFeedback.formMessage}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded border border-transparent bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-4 text-slate-700">
        New here?{' '}
        <Link to="/register" state={registerState} className="font-medium text-emerald-800 underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}

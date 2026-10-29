import { useLocation } from 'react-router';
import { readLoginState } from '../auth/loginRedirect';

export default function Login() {
  const { expired } = readLoginState(useLocation().state);

  return (
    <section>
      <h1 className="text-2xl font-bold">Log in</h1>
      {expired && (
        <p role="status" className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
          Your session has expired. Please log in again.
        </p>
      )}
      <p className="mt-2 text-slate-600">The login form is coming soon.</p>
    </section>
  );
}

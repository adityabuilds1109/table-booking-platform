import { Navigate, Outlet, useLocation } from 'react-router';
import { loginStateFor } from './loginRedirect';
import { useAuth } from './useAuth';

// Wraps pages that need a logged-in user. Everything inside renders through <Outlet />.
export default function RequireAuth() {
  const { state, retry } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'loading':
      return <p className="mx-auto max-w-page px-4 py-8 text-muted sm:px-8">Checking your session…</p>;
    case 'error':
      return (
        <div className="mx-auto max-w-page px-4 py-8 sm:px-8">
          <div role="alert" className="rounded-xl border border-danger-line bg-danger-soft p-4 text-danger-text">
            <p>{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 min-h-12 rounded-xl bg-ink px-5 font-semibold text-white hover:bg-ink-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Try again
            </button>
          </div>
        </div>
      );
    case 'anonymous':
      // `replace` so the Back button doesn't return to a page that would just redirect again.
      return <Navigate to="/login" replace state={loginStateFor(location, state.expired === true)} />;
    case 'authenticated':
      return <Outlet />;
  }
}

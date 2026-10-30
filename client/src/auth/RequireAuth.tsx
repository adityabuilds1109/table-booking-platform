import { Navigate, Outlet, useLocation } from 'react-router';
import { loginStateFor } from './loginRedirect';
import { useAuth } from './useAuth';

// Wraps pages that need a logged-in user. Everything inside renders through <Outlet />.
export default function RequireAuth() {
  const { state, retry } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'loading':
      return <p className="text-slate-600">Checking your session…</p>;
    case 'error':
      return (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          <p>{state.message}</p>
          <button type="button" onClick={retry} className="mt-2 rounded bg-red-700 px-3 py-1 text-white hover:bg-red-800">
            Try again
          </button>
        </div>
      );
    case 'anonymous':
      // `replace` so the Back button doesn't return to a page that would just redirect again.
      return <Navigate to="/login" replace state={loginStateFor(location, state.expired === true)} />;
    case 'authenticated':
      return <Outlet />;
  }
}

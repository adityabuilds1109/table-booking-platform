import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 hover:bg-slate-100 ${isActive ? 'font-semibold text-emerald-700' : 'text-slate-700'}`;

export default function Layout() {
  const { state, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-emerald-700">
            Table Booking
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Find a table
            </NavLink>
            {state.status === 'authenticated' && (
              <NavLink to="/bookings" className={linkClass}>
                My bookings
              </NavLink>
            )}
            {state.status === 'anonymous' && (
              <>
                <NavLink to="/login" className={linkClass}>
                  Log in
                </NavLink>
                <NavLink to="/register" className={linkClass}>
                  Register
                </NavLink>
              </>
            )}
            {state.status === 'authenticated' && (
              <>
                <span className="px-2 text-sm text-slate-600" data-testid="user-email">
                  {state.user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

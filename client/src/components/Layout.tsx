import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth';

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded text-sm ${FOCUS_RING} ${
    isActive
      ? 'font-semibold text-white underline decoration-brass decoration-[1.5px] underline-offset-[6px]'
      : 'text-on-ink-muted hover:text-white'
  }`;

export default function Layout() {
  const { state, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-ink-raised px-4 py-2 sm:px-8">
          <Link
            to="/"
            className={`inline-flex min-h-11 items-center gap-3 rounded ${FOCUS_RING}`}
          >
            <span className="flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-brass text-brass">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M7 3v5M17 21V3c-2 1.5-3 4-3 7a3 3 0 0 0 3 3" />
              </svg>
            </span>
            <span className="font-display text-[21px] font-semibold text-white">
              Table Booking
            </span>
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1">
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
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-ink-raised text-sm font-semibold text-brass"
                  >
                    {state.user.email.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm text-on-ink-muted" data-testid="user-email">
                    {state.user.email}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className={`min-h-11 rounded-full border border-ink-line px-4 text-sm text-white hover:bg-ink-raised ${FOCUS_RING}`}
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

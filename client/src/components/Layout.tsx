import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth';

// The active page is shown by weight and underline as well as colour, so it survives forced-colors mode and colour blindness.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `focus-ring inline-flex min-h-11 items-center rounded-control px-3 hover:bg-hover ${
    isActive ? 'bg-accent-tint font-semibold text-accent-strong underline underline-offset-4' : 'text-ink-soft'
  }`;

// A plate seen from above: decorative, so it is hidden from assistive technology (the wordmark beside it names the link).
function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

export default function Layout() {
  const { state, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <Link to="/" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-control font-display text-xl font-bold text-ink">
            <LogoMark />
            Table Booking
          </Link>
          <nav aria-label="Main" className="-mx-3 flex flex-wrap items-center gap-1 sm:mx-0">
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
                <span className="max-w-48 truncate px-2 text-sm text-ink-soft" data-testid="user-email">
                  {state.user.email}
                </span>
                <button type="button" onClick={logout} className="btn btn-secondary">
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:justify-between sm:px-6">
          <p>
            <span className="font-display font-bold text-ink">Table Booking</span> · Reserve a table in a few taps.
          </p>
          <p>Times are shown in your device&apos;s time zone.</p>
        </div>
      </footer>
    </div>
  );
}

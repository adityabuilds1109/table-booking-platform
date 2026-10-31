import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import MyBookingRow from '../booking/MyBookingRow';
import { describeListPage, readPageParam } from '../booking/myBookings';
import { useMyBookings } from '../booking/useMyBookings';
import Pagination from '../components/Pagination';

export default function MyBookings() {
  const [params] = useSearchParams();
  const page = readPageParam(params);
  const { state, reload } = useMyBookings(page);

  // After moving to another page, focus goes to the heading so a keyboard or screen-reader user starts at the top of the new
  // page instead of on a link that has just changed meaning. Not on the first visit (the browser's own focus handling is right).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current !== page) headingRef.current?.focus();
    shownPage.current = page;
  }, [page]);

  const now = new Date();
  const loaded = state.status === 'success' ? state.page : null;
  const statusText =
    state.status === 'loading'
      ? 'Loading your bookings…'
      : state.status === 'error'
        ? state.message
        : describeListPage({ page, pageSize: state.page.pageSize, total: state.page.total, shown: state.page.data.length });

  return (
    <section>
      <title>My bookings – Table Booking</title>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
        My bookings
      </h1>
      {/* Always in the page (empty text is never needed here): changes to an existing live region are announced reliably. */}
      <p role="status" className="mt-2 text-slate-800">
        {statusText}
      </p>

      {state.status === 'error' && state.retryable && (
        <button
          type="button"
          onClick={reload}
          className="mt-2 rounded border border-transparent bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Try again
        </button>
      )}

      <div aria-busy={state.status === 'loading'}>
        {loaded !== null && loaded.total === 0 && (
          <p className="mt-3">
            <Link to="/" className="font-medium text-emerald-800 underline">
              Find a table
            </Link>
          </p>
        )}
        {loaded !== null && loaded.total > 0 && loaded.data.length === 0 && (
          <p className="mt-3">
            <Link to="/bookings" className="font-medium text-emerald-800 underline">
              Back to your latest bookings
            </Link>
          </p>
        )}
        {loaded !== null && loaded.data.length > 0 && (
          <ul className="mt-3 space-y-2">
            {loaded.data.map((booking) => (
              <MyBookingRow key={booking.id} booking={booking} now={now} />
            ))}
          </ul>
        )}
        {loaded !== null && <Pagination page={page} totalPages={loaded.totalPages} />}
      </div>
    </section>
  );
}

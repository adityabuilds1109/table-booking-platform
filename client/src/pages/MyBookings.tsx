import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import MyBookingRow, { type RowMode } from '../booking/MyBookingRow';
import { describeListPage, readPageParam } from '../booking/myBookings';
import { useCancelBooking } from '../booking/useCancelBooking';
import { useMyBookings } from '../booking/useMyBookings';
import Pagination from '../components/Pagination';

const rowMode = (phase: ReturnType<typeof useCancelBooking>['phase'], id: string): RowMode =>
  phase.phase !== 'idle' && phase.id === id ? phase.phase : 'idle';

export default function MyBookings() {
  const [params] = useSearchParams();
  const page = readPageParam(params);
  const { state, reload, patchBooking } = useMyBookings(page);
  const cancel = useCancelBooking({ onCancelled: patchBooking, reloadList: reload });
  const pending = cancel.phase.phase === 'pending' ? cancel.phase : null;

  // After moving to another page, focus goes to the heading so a keyboard or screen-reader user starts at the top of the new
  // page instead of on a link that has just changed meaning. Not on the first visit (the browser's own focus handling is right).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current !== page) {
      headingRef.current?.focus();
      cancel.reset();
    }
    shownPage.current = page;
  }, [page]);

  // A failed cancel's message gets focus, so it is read out and a keyboard user is not left on a button that has changed.
  const messageRef = useRef<HTMLParagraphElement>(null);
  const failedText = cancel.message?.kind === 'failed' ? cancel.message.text : null;
  useEffect(() => {
    if (failedText !== null) messageRef.current?.focus();
  }, [failedText]);

  const now = new Date();
  const loaded = state.status === 'success' ? state.page : null;
  const statusText =
    pending !== null
      ? `Cancelling booking for table ${pending.tableName}…`
      : cancel.message?.kind === 'done'
        ? cancel.message.text
        : state.status === 'loading'
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
      {/* Always in the page (empty until needed), like the status line: alerts put into an existing region are announced reliably. */}
      <div role="alert">
        {failedText !== null && (
          <p ref={messageRef} tabIndex={-1} className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-red-800">
            {failedText}
          </p>
        )}
      </div>

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
              <MyBookingRow
                key={booking.id}
                booking={booking}
                now={now}
                mode={rowMode(cancel.phase, booking.id)}
                anyPending={pending !== null}
                focusRow={cancel.message?.kind === 'done' && cancel.message.bookingId === booking.id}
                onAsk={() => cancel.ask(booking.id)}
                onKeep={cancel.keep}
                onConfirm={() => void cancel.confirm(booking)}
              />
            ))}
          </ul>
        )}
        {loaded !== null && <Pagination page={page} totalPages={loaded.totalPages} />}
      </div>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import MyBookingRow, { type RowMode } from '../booking/MyBookingRow';
import { describeListPage, readPageParam } from '@table-booking/shared/booking';
import { useCancelBooking } from '@table-booking/shared/react';
import { useMyBookings } from '@table-booking/shared/react';
import Pagination from '../components/Pagination';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const CARD = 'overflow-hidden rounded-[18px] border border-line bg-white shadow-card';
const LINK = `inline-flex min-h-11 items-center rounded font-semibold text-brass-text underline ${FOCUS_RING}`;

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
      <div className="bg-ink">
        <div className="mx-auto max-w-page px-4 pt-12 pb-14 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Your reservations</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 w-fit rounded font-display text-[44px] leading-[1.05] font-bold tracking-[-0.03em] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
          >
            My bookings
          </h1>
          {/* Always in the page (empty text is never needed here): changes to an existing live region are announced reliably. */}
          <p role="status" className="mt-4 max-w-2xl text-on-ink-muted">
            {statusText}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-page px-4 py-8 sm:px-8">
        {/* Always in the page (empty until needed), like the status line: alerts put into an existing region are announced reliably. */}
        <div role="alert">
          {failedText !== null && (
            <p
              ref={messageRef}
              tabIndex={-1}
              className={`mb-4 rounded-xl border border-danger-line bg-danger-soft p-4 text-danger-text ${FOCUS_RING}`}
            >
              {failedText}
            </p>
          )}
        </div>

        {state.status === 'error' && state.retryable && (
          <button
            type="button"
            onClick={reload}
            className={`min-h-12 rounded-xl bg-ink px-5 font-semibold text-white hover:bg-ink-raised ${FOCUS_RING}`}
          >
            Try again
          </button>
        )}

        <div aria-busy={state.status === 'loading'}>
          {loaded !== null && loaded.total === 0 && (
            <p className={CARD + ' p-6'}>
              <Link to="/" className={LINK}>
                Find a table
              </Link>
            </p>
          )}
          {loaded !== null && loaded.total > 0 && loaded.data.length === 0 && (
            <p className={CARD + ' p-6'}>
              <Link to="/bookings" className={LINK}>
                Back to your latest bookings
              </Link>
            </p>
          )}
          {loaded !== null && loaded.data.length > 0 && (
            <ul className={`${CARD} divide-y divide-line-soft`}>
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
      </div>
    </section>
  );
}

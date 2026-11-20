import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { Booking } from '@table-booking/shared/api';
import { formatTimeRange } from '@table-booking/shared/booking';

const SECONDARY_BUTTON =
  'inline-flex min-h-11 items-center rounded-full border border-field bg-white px-5 font-semibold text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

type Props = { booking: Booking; tableName: string; onSearchAgain: () => void };

// Shown instead of the results once a booking succeeded. It shows what the SERVER stored (its start and end times), not what
// was typed in the form, so what is displayed is what is booked. Focus moves to the heading so a keyboard or screen-reader
// user lands on the confirmation instead of on a button that no longer exists.
export default function BookingConfirmation({ booking, tableName, onSearchAgain }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="confirmation-heading"
      className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8"
    >
      <h2
        id="confirmation-heading"
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-3 font-display text-[30px] leading-tight font-semibold text-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="m8 12.3 2.8 2.8L16 9.5" />
        </svg>
        You&apos;re booked
      </h2>
      <p className="mt-3 text-body">
        Table {tableName}, {formatTimeRange(booking.startsAt, booking.endsAt)}, party of {booking.partySize}.
      </p>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link to="/bookings" className={SECONDARY_BUTTON}>
          My bookings
        </Link>
        <button type="button" onClick={onSearchAgain} className={SECONDARY_BUTTON}>
          Search again
        </button>
      </p>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { Booking } from '../api/schemas';
import { formatTimeRange } from './timeConversion';

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
    <section aria-labelledby="confirmation-heading" className="mt-6 rounded border border-emerald-300 bg-emerald-50 p-4">
      <h2 id="confirmation-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-emerald-900">
        You&apos;re booked
      </h2>
      <p className="mt-2 text-slate-900">
        Table {tableName}, {formatTimeRange(booking.startsAt, booking.endsAt)}, party of {booking.partySize}.
      </p>
      <p className="mt-3 flex flex-wrap gap-4">
        <Link to="/bookings" className="font-medium text-emerald-800 underline">
          My bookings
        </Link>
        <button type="button" onClick={onSearchAgain} className="font-medium text-emerald-800 underline">
          Search again
        </button>
      </p>
    </section>
  );
}

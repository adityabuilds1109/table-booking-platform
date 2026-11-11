import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { Booking } from '../api/schemas';
import { IconCheck } from '../components/icons';
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
    <section aria-labelledby="confirmation-heading" className="card mt-8 p-6 text-center sm:p-8">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
        <IconCheck className="h-7 w-7" />
      </span>
      <h2 id="confirmation-heading" ref={headingRef} tabIndex={-1} className="mt-4 font-display text-2xl font-bold">
        You&apos;re booked
      </h2>
      <p className="mt-1 text-ink-soft">Your table is reserved. See you there.</p>

      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-control bg-canvas p-4 text-left">
        <dt className="text-ink-soft">Table</dt>
        <dd className="font-medium text-ink">{tableName}</dd>
        <dt className="text-ink-soft">When</dt>
        <dd className="font-medium text-ink">{formatTimeRange(booking.startsAt, booking.endsAt)}</dd>
        <dt className="text-ink-soft">Guests</dt>
        <dd className="font-medium text-ink">{booking.partySize}</dd>
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/bookings" className="btn btn-primary">
          View my bookings
        </Link>
        <button type="button" onClick={onSearchAgain} className="btn btn-secondary">
          Search again
        </button>
      </div>
    </section>
  );
}

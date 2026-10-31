import type { MyBooking } from '../api/schemas';
import { describeBookingStatus } from './myBookings';
import { formatTimeRange } from './timeConversion';

// The status is always a WORD ("Confirmed", "Past", "Cancelled"), never colour alone; the colour only reinforces it.
const STATUS_STYLE = {
  Confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  Past: 'border-slate-300 bg-slate-100 text-slate-800',
  Cancelled: 'border-red-200 bg-red-50 text-red-800',
} as const;

export default function MyBookingRow({ booking, now }: { booking: MyBooking; now: Date }) {
  const status = describeBookingStatus(booking, now);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white p-3">
      <div>
        <p className="font-medium text-slate-900">Table {booking.table.name}</p>
        <p className="text-slate-800">
          <time dateTime={booking.startsAt}>{formatTimeRange(booking.startsAt, booking.endsAt)}</time>
        </p>
        <p className="text-sm text-slate-700">Party of {booking.partySize}</p>
      </div>
      <p className={`rounded border px-2 py-1 text-sm font-medium ${STATUS_STYLE[status.label]}`}>{status.label}</p>
    </li>
  );
}

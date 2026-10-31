import { useEffect, useRef } from 'react';
import type { MyBooking } from '../api/schemas';
import { describeBookingStatus } from './myBookings';
import { formatInstant, formatTimeRange } from './timeConversion';

// The status is always a WORD ("Confirmed", "Past", "Cancelled"), never colour alone; the colour only reinforces it.
const STATUS_STYLE = {
  Confirmed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  Past: 'border-slate-300 bg-slate-100 text-slate-800',
  Cancelled: 'border-red-200 bg-red-50 text-red-800',
} as const;

const BUTTON =
  'min-h-10 rounded border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60';

export type RowMode = 'idle' | 'confirming' | 'pending';

type Props = {
  booking: MyBooking;
  now: Date;
  mode: RowMode;
  // Some row (maybe another one) is being cancelled: no cancel action is available anywhere until it finishes.
  anyPending: boolean;
  // True once, right after this row was cancelled: focus goes to the row, because the button that had it is gone.
  focusRow: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onConfirm: () => void;
};

export default function MyBookingRow({ booking, now, mode, anyPending, focusRow, onAsk, onKeep, onConfirm }: Props) {
  const status = describeBookingStatus(booking, now);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef<RowMode>(mode);

  // Asking moves focus to "Keep it", the safe choice; declining (Keep it or Escape) puts focus back on "Cancel booking".
  useEffect(() => {
    if (mode === 'confirming' && previousMode.current === 'idle') keepRef.current?.focus();
    if (mode === 'idle' && previousMode.current === 'confirming') askRef.current?.focus();
    previousMode.current = mode;
  }, [mode]);

  useEffect(() => {
    if (focusRow) nameRef.current?.focus();
  }, [focusRow]);

  const description = `table ${booking.table.name}, ${formatInstant(booking.startsAt)}`;

  return (
    <li className="rounded border border-slate-300 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p ref={nameRef} tabIndex={-1} className="font-medium text-slate-900">
            Table {booking.table.name}
          </p>
          <p className="text-slate-800">
            <time dateTime={booking.startsAt}>{formatTimeRange(booking.startsAt, booking.endsAt)}</time>
          </p>
          <p className="text-sm text-slate-700">Party of {booking.partySize}</p>
        </div>
        <p className={`rounded border px-2 py-1 text-sm font-medium ${STATUS_STYLE[status.label]}`}>{status.label}</p>
      </div>

      {status.cancellable && mode === 'idle' && (
        <button
          ref={askRef}
          type="button"
          onClick={onAsk}
          disabled={anyPending}
          // The visible words "Cancel booking" are contained in the accessible name, as WCAG asks; the rest makes it unique.
          aria-label={`Cancel booking for ${description}`}
          className={`${BUTTON} mt-3 border-red-700 bg-white text-red-800 hover:bg-red-50`}
        >
          Cancel booking
        </button>
      )}

      {status.cancellable && mode !== 'idle' && (
        <div
          role="group"
          aria-label={`Confirm cancelling ${description}`}
          className="mt-3 flex flex-wrap items-center gap-3"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onKeep();
          }}
        >
          <p className="font-medium text-slate-900">Cancel this booking?</p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={anyPending}
            className={`${BUTTON} border-transparent bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-500`}
          >
            {mode === 'pending' ? 'Cancelling…' : 'Yes, cancel booking'}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            disabled={anyPending}
            className={`${BUTTON} border-slate-500 bg-white text-slate-900 hover:bg-slate-100`}
          >
            Keep it
          </button>
        </div>
      )}
    </li>
  );
}

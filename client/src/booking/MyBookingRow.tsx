import { useEffect, useRef } from 'react';
import type { MyBooking } from '@table-booking/shared/api';
import { describeBookingStatus } from '@table-booking/shared/booking';
import { formatInstant, formatTimeRange } from '@table-booking/shared/booking';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// The status is always a WORD ("Confirmed", "Past", "Cancelled"), never colour alone; the colour only reinforces it.
const NEUTRAL_PILL =
  'rounded-full bg-neutral-pill px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-pill-text';

const BUTTON = `min-h-11 rounded-full px-5 text-sm font-semibold ${FOCUS_RING} disabled:cursor-not-allowed`;

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
  const timeClass = status.label === 'Cancelled' ? 'text-muted line-through' : 'text-ink';

  return (
    <li className={`px-5 py-4 sm:px-6 ${status.cancellable && mode !== 'idle' ? 'bg-paper-soft' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <p className={`text-[17px] font-semibold ${timeClass}`}>
            <time dateTime={booking.startsAt}>{formatTimeRange(booking.startsAt, booking.endsAt)}</time>
          </p>
          <p ref={nameRef} tabIndex={-1} className={`mt-1 rounded text-sm text-muted ${FOCUS_RING}`}>
            Table {booking.table.name} · Party of {booking.partySize}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {status.label === 'Confirmed' ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-success" />
              {status.label}
            </p>
          ) : (
            <p className={NEUTRAL_PILL}>{status.label}</p>
          )}
          {status.cancellable && mode === 'idle' && (
            <button
              ref={askRef}
              type="button"
              onClick={onAsk}
              disabled={anyPending}
              // The visible words "Cancel booking" are contained in the accessible name, as WCAG asks; the rest makes it unique.
              aria-label={`Cancel booking for ${description}`}
              className={`${BUTTON} border border-danger-line bg-white text-danger hover:bg-danger-soft disabled:opacity-60`}
            >
              Cancel booking
            </button>
          )}
        </div>
      </div>

      {status.cancellable && mode !== 'idle' && (
        <div
          role="group"
          aria-label={`Confirm cancelling ${description}`}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger-line bg-danger-soft p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onKeep();
          }}
        >
          <p className="mr-auto font-semibold text-danger-text">Cancel this booking?</p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={anyPending}
            className={`${BUTTON} bg-danger text-white hover:bg-danger-text disabled:bg-ink-line disabled:text-on-ink-disabled`}
          >
            {mode === 'pending' ? 'Cancelling…' : 'Yes, cancel booking'}
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={onKeep}
            disabled={anyPending}
            className={`${BUTTON} border border-field bg-white text-ink hover:bg-paper disabled:opacity-60`}
          >
            Keep it
          </button>
        </div>
      )}
    </li>
  );
}

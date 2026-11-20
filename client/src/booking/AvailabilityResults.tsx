import type { AvailableTable } from '@table-booking/shared/api';
import { formatTimeRange } from '@table-booking/shared/booking';
import type { AvailabilityState } from '@table-booking/shared/react';

export type SearchSummary = { startsAt: string; endsAt: string; partySize: number; ambiguousZone: string | null };

// `bookingTableId`: the row whose booking is being sent (null = none). While any booking is pending every Book button is
// disabled; `bookDisabledReason` (for example while the login check runs) disables them too.
type Props = {
  state: AvailabilityState;
  summary: SearchSummary | null;
  onRetry: () => void;
  onBook: (table: AvailableTable) => void;
  bookingTableId: string | null;
  bookingTableName: string | null;
  bookDisabled: boolean;
};

function statusText(state: AvailabilityState, bookingTableName: string | null): string {
  if (bookingTableName !== null) return `Booking table ${bookingTableName}…`;
  switch (state.status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Searching…';
    case 'error':
      return state.message;
    case 'success':
      return state.tables.length === 0
        ? 'No tables are free at that time. Try another time or a smaller party.'
        : `${state.tables.length} ${state.tables.length === 1 ? 'table' : 'tables'} available.`;
  }
}

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const PRIMARY_BUTTON = `min-h-12 rounded-xl bg-ink px-5 font-semibold text-white hover:bg-ink-raised ${FOCUS_RING}`;

export default function AvailabilityResults({ state, summary, onRetry, onBook, bookingTableId, bookingTableName, bookDisabled }: Props) {
  // The big section title is only for a real list of tables; loading, error and "no tables" text stays body size.
  const hasTables = state.status === 'success' && state.tables.length > 0;
  return (
    <section aria-labelledby="results-heading" aria-busy={state.status === 'loading'} className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
        {/* Always in the page (empty until there is something to say): changes to text inside an existing live region are announced reliably, a region that appears together with its text is not. */}
        <p role="status" className={`order-1 ${hasTables ? 'font-display text-[30px] leading-tight font-bold tracking-[-0.03em]' : 'text-body'}`}>
          {statusText(state, bookingTableName)}
        </p>
        {summary !== null && state.status !== 'idle' && (
          <h2 id="results-heading" className="order-2 text-sm text-muted">
            {formatTimeRange(summary.startsAt, summary.endsAt)}, party of {summary.partySize}
          </h2>
        )}
      </div>
      {summary?.ambiguousZone != null && state.status !== 'idle' && (
        <p className="mt-3 text-sm text-muted">
          That time happens twice because the clocks change. The earlier one ({summary.ambiguousZone}) is used.
        </p>
      )}
      {state.status === 'error' && state.retryable && (
        <button type="button" onClick={onRetry} className={`mt-4 ${PRIMARY_BUTTON}`}>
          Try again
        </button>
      )}
      {state.status === 'success' && state.tables.length > 0 && (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {state.tables.map((table) => {
            const inProgress = bookingTableId === table.id;
            return (
              <li
                key={table.id}
                className={`flex flex-col rounded-2xl bg-white p-5 shadow-card ${
                  inProgress ? 'border-[1.5px] border-brass' : 'border border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Table</p>
                    <p className="font-display text-[40px] leading-none font-bold tracking-[-0.03em]">{table.name}</p>
                  </div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-body">
                    <span
                      aria-hidden="true"
                      className={`size-[7px] rounded-full ${inProgress ? 'bg-brass' : 'bg-success'}`}
                    />
                    {inProgress ? 'In progress' : 'Available'}
                  </p>
                </div>
                <p className="mt-4 mb-5 flex items-center gap-2 text-muted">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3c2 .7 3.5 2.5 3.5 5.7" />
                  </svg>
                  Seats up to {table.capacity}
                </p>
                <button
                  type="button"
                  onClick={() => onBook(table)}
                  disabled={bookingTableId !== null || bookDisabled}
                  // The visible word "Book" is contained in the accessible name, as WCAG asks; the table makes it unique.
                  aria-label={inProgress ? undefined : `Book table ${table.name}`}
                  className={`mt-auto w-full disabled:cursor-not-allowed disabled:bg-ink-line disabled:text-on-ink-disabled ${PRIMARY_BUTTON}`}
                >
                  {inProgress ? 'Booking…' : 'Book'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

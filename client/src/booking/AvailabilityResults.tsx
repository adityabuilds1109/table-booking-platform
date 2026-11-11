import type { AvailableTable } from '../api/schemas';
import EmptyState from '../components/EmptyState';
import { IconClock, IconNoTable, IconPeople } from '../components/icons';
import { formatTimeRange } from './timeConversion';
import type { AvailabilityState } from './useAvailability';

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

export default function AvailabilityResults({ state, summary, onRetry, onBook, bookingTableId, bookingTableName, bookDisabled }: Props) {
  const noTables = state.status === 'success' && state.tables.length === 0;

  return (
    <section aria-labelledby="results-heading" aria-busy={state.status === 'loading'} className="mt-8">
      {summary !== null && state.status !== 'idle' && (
        <h2 id="results-heading" className="font-display text-xl font-bold">
          {formatTimeRange(summary.startsAt, summary.endsAt)}, party of {summary.partySize}
        </h2>
      )}
      {/* Always in the page (empty until there is something to say): changes to text inside an existing live region are announced reliably, a region that appears together with its text is not.
          When there are no tables the empty-state card says it on screen, so this line is visually hidden but still announced. */}
      <p
        role="status"
        className={noTables ? 'sr-only' : `mt-2 ${state.status === 'error' ? 'font-medium text-danger' : 'text-ink-soft'}`}
      >
        {statusText(state, bookingTableName)}
      </p>
      {summary?.ambiguousZone != null && state.status !== 'idle' && (
        <p className="mt-2 text-sm text-ink-soft">
          That time happens twice because the clocks change. The earlier one ({summary.ambiguousZone}) is used.
        </p>
      )}
      {state.status === 'error' && state.retryable && (
        <button type="button" onClick={onRetry} className="btn btn-primary mt-3">
          Try again
        </button>
      )}
      {noTables && (
        <EmptyState icon={<IconNoTable className="h-6 w-6" />} title="No tables free at that time">
          Try a different start time, a shorter stay or fewer guests.
        </EmptyState>
      )}
      {state.status === 'success' && state.tables.length > 0 && (
        <ul className="mt-4 space-y-3">
          {state.tables.map((table) => (
            <li key={table.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-ink">{table.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <IconPeople />
                    Seats {table.capacity}
                  </span>
                  {summary !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconClock />
                      {formatTimeRange(summary.startsAt, summary.endsAt)}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBook(table)}
                disabled={bookingTableId !== null || bookDisabled}
                // The visible word "Book" is contained in the accessible name, as WCAG asks; the table makes it unique.
                aria-label={bookingTableId === table.id ? undefined : `Book table ${table.name}`}
                className="btn btn-primary w-full sm:w-auto sm:min-w-28"
              >
                {bookingTableId === table.id ? 'Booking…' : 'Book'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { formatTimeRange } from './timeConversion';
import type { AvailabilityState } from './useAvailability';

export type SearchSummary = { startsAt: string; endsAt: string; partySize: number; ambiguousZone: string | null };

type Props = { state: AvailabilityState; summary: SearchSummary | null; onRetry: () => void };

function statusText(state: AvailabilityState): string {
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

export default function AvailabilityResults({ state, summary, onRetry }: Props) {
  return (
    <section aria-labelledby="results-heading" aria-busy={state.status === 'loading'} className="mt-6">
      {summary !== null && state.status !== 'idle' && (
        <h2 id="results-heading" className="text-lg font-semibold">
          {formatTimeRange(summary.startsAt, summary.endsAt)}, party of {summary.partySize}
        </h2>
      )}
      {/* Always in the page (empty until there is something to say): changes to text inside an existing live region are announced reliably, a region that appears together with its text is not. */}
      <p role="status" className="mt-2 text-slate-800">
        {statusText(state)}
      </p>
      {summary?.ambiguousZone != null && state.status !== 'idle' && (
        <p className="mt-2 text-sm text-slate-700">
          That time happens twice because the clocks change. The earlier one ({summary.ambiguousZone}) is used.
        </p>
      )}
      {state.status === 'error' && state.retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded border border-transparent bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Try again
        </button>
      )}
      {state.status === 'success' && state.tables.length > 0 && (
        <ul className="mt-3 space-y-2">
          {state.tables.map((table) => (
            <li key={table.id} className="flex items-center justify-between rounded border border-slate-300 bg-white p-3">
              <span className="font-medium">{table.name}</span>
              <span className="text-slate-700">Seats {table.capacity}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

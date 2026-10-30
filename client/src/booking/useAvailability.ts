import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { AvailabilityQuery } from '../api/endpoints';
import { api } from '../api';
import type { AvailableTable } from '../api/schemas';
import { describeSearchError } from './bookingErrors';

export type AvailabilityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; tables: readonly AvailableTable[] }
  | { status: 'error'; message: string; retryable: boolean };

// Runs GET /tables/availability whenever `query` changes (null = no search, so nothing is requested).
//  - Each search gets its own AbortController. Starting a newer search, or leaving the page, aborts the older request, and
//    a response that still arrives from an aborted search is dropped, so old results can never replace newer ones.
//  - An aborted request is not an error and shows nothing.
// `reload` repeats the current search (Retry, or "search again" with identical values).
export function useAvailability(query: AvailabilityQuery | null): { state: AvailabilityState; reload: () => void } {
  const [state, setState] = useState<AvailabilityState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  // The query is read through its fields: a new object with the same values must not start a new search.
  const date = query?.date;
  const startTime = query?.startTime;
  const durationMinutes = query?.durationMinutes;
  const partySize = query?.partySize;

  useEffect(() => {
    if (date === undefined || startTime === undefined || durationMinutes === undefined || partySize === undefined) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });

    api
      .getAvailability({ date, startTime, durationMinutes, partySize }, controller.signal)
      .then((tables) => {
        if (!controller.signal.aborted) setState({ status: 'success', tables });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
        if (!(error instanceof ApiError)) throw error;
        setState({ status: 'error', ...describeSearchError(error) });
      });

    return () => controller.abort();
  }, [date, startTime, durationMinutes, partySize, attempt]);

  return { state, reload: () => setAttempt((current) => current + 1) };
}

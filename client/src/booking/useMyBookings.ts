import { useEffect, useState } from 'react';
import { api } from '../api';
import { ApiError } from '../api/client';
import type { MyBooking, MyBookingsPage } from '../api/schemas';
import { describeListError } from './bookingErrors';
import { MY_BOOKINGS_PAGE_SIZE } from './bookingLimits';
import { replaceBooking } from './myBookings';

export type MyBookingsState =
  | { status: 'loading' }
  | { status: 'success'; page: MyBookingsPage }
  | { status: 'error'; message: string; retryable: boolean };

// Loads one page of the caller's bookings (GET /bookings/me) and loads it again whenever `page` changes.
//  - Each request gets its own AbortController. Asking for another page, or leaving the screen, aborts the older request, and
//    an answer that still arrives from an aborted request is dropped, so an old page can never replace a newer one.
//  - An aborted request is not an error and shows nothing.
// `reload` loads the current page again; `patchBooking` swaps in a booking that just changed (a cancel) without a request.
export function useMyBookings(page: number): {
  state: MyBookingsState;
  reload: () => void;
  patchBooking: (updated: Pick<MyBooking, 'id' | 'status'>) => void;
} {
  // Every result is stored together with the page it belongs to. In the render right after the page number changes, the
  // effect below has not started yet and `stored` still holds the PREVIOUS page; showing it would put page 1's rows under
  // "page 2". So a result for another page counts as "loading".
  const [stored, setStored] = useState<{ forPage: number; state: MyBookingsState }>({ forPage: page, state: { status: 'loading' } });
  const state: MyBookingsState = stored.forPage === page ? stored.state : { status: 'loading' };
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStored({ forPage: page, state: { status: 'loading' } });

    api
      .listMyBookings({ page, pageSize: MY_BOOKINGS_PAGE_SIZE }, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setStored({ forPage: page, state: { status: 'success', page: loaded } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
        if (!(error instanceof ApiError)) throw error;
        setStored({ forPage: page, state: { status: 'error', ...describeListError(error) } });
      });

    return () => controller.abort();
  }, [page, attempt]);

  return {
    state,
    reload: () => setAttempt((current) => current + 1),
    patchBooking: (updated) =>
      setStored((current) =>
        current.state.status === 'success'
          ? { forPage: current.forPage, state: { status: 'success', page: replaceBooking(current.state.page, updated) } }
          : current,
      ),
  };
}

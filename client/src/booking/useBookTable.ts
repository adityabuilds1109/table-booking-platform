import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ApiError } from '../api/client';
import type { AvailableTable, Booking } from '../api/schemas';
import { describeBookingError } from './bookingErrors';
import type { ValidSearch } from './searchValidation';

export type BookingState =
  | { phase: 'idle' }
  | { phase: 'pending'; tableName: string; tableId: string }
  // `message` is what to tell the person; the page moves focus to it.
  | { phase: 'failed'; message: string }
  | { phase: 'booked'; booking: Booking; tableName: string };

// Books one table for the current search. Two decisions worth knowing:
//  - The POST is deliberately NOT given an AbortSignal. Cancelling a write on the client does not stop the server: it could
//    still create the booking while the person believes it failed. So the request is left to finish; if the person has gone
//    to another page by then, nothing is updated (the booking will be in "My bookings").
//  - `pendingRef` is a ref as well as state: state updates lag a render, so a fast double click would otherwise get past a
//    "pending" check and send two requests.
export function useBookTable(search: ValidSearch | null, refreshResults: () => void) {
  const [state, setState] = useState<BookingState>({ phase: 'idle' });
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function book(table: AvailableTable): Promise<void> {
    if (search === null || pendingRef.current) return;
    pendingRef.current = true;
    setState({ phase: 'pending', tableName: table.name, tableId: table.id });
    try {
      const booking = await api.createBooking({
        tableId: table.id,
        startsAt: search.slot.startsAt,
        durationMinutes: search.durationMinutes,
        partySize: search.partySize,
      });
      pendingRef.current = false;
      if (mountedRef.current) setState({ phase: 'booked', booking, tableName: table.name });
    } catch (error: unknown) {
      pendingRef.current = false;
      // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
      if (!(error instanceof ApiError)) throw error;
      if (!mountedRef.current) return;
      const feedback = describeBookingError(error, search.partySize);
      setState({ phase: 'failed', message: feedback.message });
      if (feedback.refreshResults) refreshResults();
    }
  }

  // Shows a message without having sent anything (for example "we could not check your login").
  function fail(message: string): void {
    if (!pendingRef.current) setState({ phase: 'failed', message });
  }

  // Back to the search results. A booking that is still being sent is left alone: it will finish, and its result is shown.
  function reset(): void {
    if (!pendingRef.current) setState({ phase: 'idle' });
  }

  return { state, book, fail, reset };
}

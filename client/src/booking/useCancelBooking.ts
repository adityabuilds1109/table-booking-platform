import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ApiError } from '../api/client';
import type { Booking, MyBooking } from '../api/schemas';
import { describeCancelError } from './bookingErrors';
import { formatInstant } from './timeConversion';

export type CancelPhase = { phase: 'idle' } | { phase: 'confirming'; id: string } | { phase: 'pending'; id: string; tableName: string };
// `done`: shown in the page's status line (a live region) and focus goes to that booking's row.
// `failed`: shown in an alert region and focus goes to the message.
export type CancelMessage = { kind: 'done'; bookingId: string; text: string } | { kind: 'failed'; text: string };

// Two-step cancel: ask (the row shows "Cancel this booking?"), then confirm (the request). Decisions worth knowing:
//  - The PATCH is deliberately NOT given an AbortSignal: cancelling a write on the client does not stop the server, so the
//    person could believe it failed while it succeeded. It is left to finish; if the page was left, nothing is updated.
//  - `pendingRef` is a ref as well as state: state updates lag a render, so a fast double click would otherwise get past a
//    "pending" check and send two requests.
//  - Only one row can be asking at a time; asking about another row moves the question.
//  - "Already cancelled" is not an error: the server answers 200 with the cancelled booking and it takes the success path.
export function useCancelBooking({
  onCancelled,
  reloadList,
}: {
  onCancelled: (booking: Pick<Booking, 'id' | 'status'>) => void;
  reloadList: () => void;
}) {
  const [phase, setPhase] = useState<CancelPhase>({ phase: 'idle' });
  const [message, setMessage] = useState<CancelMessage | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function ask(id: string): void {
    if (pendingRef.current) return;
    setMessage(null);
    setPhase({ phase: 'confirming', id });
  }

  function keep(): void {
    if (!pendingRef.current) setPhase({ phase: 'idle' });
  }

  // Back to a clean slate (the person moved to another page). A cancel still being sent is left alone: it will finish.
  function reset(): void {
    if (pendingRef.current) return;
    setPhase({ phase: 'idle' });
    setMessage(null);
  }

  async function confirm(booking: MyBooking): Promise<void> {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPhase({ phase: 'pending', id: booking.id, tableName: booking.table.name });
    try {
      const updated = await api.cancelBooking(booking.id);
      pendingRef.current = false;
      if (!mountedRef.current) return;
      setPhase({ phase: 'idle' });
      onCancelled(updated);
      setMessage({
        kind: 'done',
        bookingId: booking.id,
        text: `Booking for table ${booking.table.name}, ${formatInstant(booking.startsAt)}, cancelled.`,
      });
    } catch (error: unknown) {
      pendingRef.current = false;
      // Anything that is not an ApiError is a bug in our code: let it surface instead of showing a vague message.
      if (!(error instanceof ApiError)) throw error;
      if (!mountedRef.current) return;
      const feedback = describeCancelError(error);
      setPhase({ phase: 'idle' });
      setMessage({ kind: 'failed', text: feedback.message });
      if (feedback.reloadList) reloadList();
    }
  }

  return { phase, message, ask, keep, confirm, reset };
}

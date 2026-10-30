import { MAX_PAGE_NUMBER } from './bookingLimits';

const PAGE_SHAPE = /^[1-9]\d*$/;

// /bookings?page=2 -> 2. Anything else (missing, "abc", "0", "-1", "1.5", "01", "1e2", a number the server would refuse) is
// page 1, so a hand-edited URL never breaks the page. Leading zeros are rejected on purpose: there is one URL per page.
export function readPageParam(params: URLSearchParams): number {
  const raw = params.get('page');
  if (raw === null || !PAGE_SHAPE.test(raw)) return 1;
  const page = Number(raw);
  return page <= MAX_PAGE_NUMBER ? page : 1;
}

// The link to a page: page 1 is the plain /bookings, so there is one URL for it.
export const pageSearch = (page: number): string => (page <= 1 ? '' : `?page=${page}`);

export type BookingStatusView = { label: 'Confirmed' | 'Past' | 'Cancelled'; cancellable: boolean };

// What to show for a booking. The server has only CONFIRMED and CANCELLED; "Past" is a CONFIRMED booking that has already
// started, worked out here from the device clock for display only. Only an upcoming CONFIRMED booking can be cancelled; the
// server decides in the end (a booking that really started answers BOOKING_STARTED). Starting exactly now counts as started,
// like the server's `startsAt <= now`.
export function describeBookingStatus(
  booking: { status: 'CONFIRMED' | 'CANCELLED'; startsAt: string },
  now: Date = new Date(),
): BookingStatusView {
  if (booking.status === 'CANCELLED') return { label: 'Cancelled', cancellable: false };
  return new Date(booking.startsAt).getTime() > now.getTime()
    ? { label: 'Confirmed', cancellable: true }
    : { label: 'Past', cancellable: false };
}

// The sentence for the page's live region, e.g. "12 bookings. Showing 11–12." Page numbers beyond the end say so.
export function describeListPage({ page, pageSize, total, shown }: { page: number; pageSize: number; total: number; shown: number }): string {
  if (total === 0) return 'You have no bookings yet.';
  if (shown === 0) return 'There are no bookings on this page.';
  const first = (page - 1) * pageSize + 1;
  if (total === 1) return '1 booking.';
  const range = shown === 1 ? `${first}` : `${first}–${first + shown - 1}`;
  return `${total} bookings. Showing ${range}.`;
}

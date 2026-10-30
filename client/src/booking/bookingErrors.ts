import type { ApiError } from '../api/client';
import { BOOKING_LIMITS } from './bookingLimits';

const NETWORK = "Can't reach the server. Check your connection and try again.";
const GENERIC = 'Something went wrong. Please try again.';
const TIME_NOT_BOOKABLE = `That time can no longer be booked. Bookings need at least ${BOOKING_LIMITS.minNoticeMinutes} minutes' notice and can be made up to ${BOOKING_LIMITS.maxAdvanceDays} days ahead. Please choose another time.`;

export type BookingFeedback = {
  message: string;
  // The table list may now be out of date (someone else booked it, it was switched off...), so load it again.
  refreshResults: boolean;
};

// What to tell a person whose "Book" click failed. The server's own wording is never shown: it is written for developers.
// Takes an ApiError; the caller re-throws anything else so real bugs stay visible.
export function describeBookingError(error: ApiError, partySize: number): BookingFeedback {
  switch (error.code) {
    case 'SLOT_TAKEN':
      return { message: "Sorry, someone just booked that table for this time. Here is what's still free.", refreshResults: true };
    case 'TABLE_INACTIVE':
    case 'NOT_FOUND':
      return { message: 'That table is no longer available. Here is what is still free.', refreshResults: true };
    case 'CAPACITY_EXCEEDED':
      return { message: `That table can't seat a party of ${partySize}. Here is what is still free.`, refreshResults: true };
    case 'BOOKING_TIME_INVALID':
      return { message: TIME_NOT_BOOKABLE, refreshResults: false };
    case 'UNAUTHORIZED':
      // The app has already ended the session and is sending the person to the login page; this is only a fallback.
      return { message: 'Please log in to book a table.', refreshResults: false };
    case 'NETWORK_ERROR':
      return { message: NETWORK, refreshResults: false };
    default:
      return { message: GENERIC, refreshResults: false };
  }
}

// What to tell a person whose SEARCH failed. `retryable`: show a "Try again" button.
export function describeSearchError(error: ApiError): { message: string; retryable: boolean } {
  switch (error.code) {
    case 'BOOKING_TIME_INVALID':
      return { message: TIME_NOT_BOOKABLE, retryable: false };
    case 'VALIDATION_ERROR':
      return { message: "We couldn't understand that search. Please check the details and try again.", retryable: false };
    case 'NETWORK_ERROR':
      return { message: NETWORK, retryable: true };
    default:
      return { message: GENERIC, retryable: true };
  }
}

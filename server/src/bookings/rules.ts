import { AppError } from '../errors';

// The booking rules in one place. Constants (not env vars): they are not secrets, and tests need fixed values.
export const BOOKING_RULES = {
  minDurationMinutes: 30,
  maxDurationMinutes: 240,
  // Start times and durations move in steps of this many minutes (19:00, 19:15, ...), so slots line up.
  slotMinutes: 15,
  minPartySize: 1,
  maxPartySize: 20,
  // A booking must start at least this long from now...
  minNoticeMinutes: 60,
  // ...and no further ahead than this.
  maxAdvanceDays: 90,
} as const;

export const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export function endsAtFor(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * MS_PER_MINUTE);
}

function invalidTime(message: string): AppError {
  return new AppError(422, 'BOOKING_TIME_INVALID', message);
}

// The rules that depend on the current time, so they cannot live in a Zod schema.
// `now` is a parameter instead of `new Date()` so tests can control the clock.
// Boundaries are inclusive: starting exactly minNoticeMinutes or maxAdvanceDays from now is allowed.
export function assertBookable(startsAt: Date, now: Date): void {
  const start = startsAt.getTime();
  const current = now.getTime();

  // Checked before the notice rule so the client gets the clearer message for a start in the past.
  if (start <= current) {
    throw invalidTime('Booking start time must be in the future');
  }
  if (start < current + BOOKING_RULES.minNoticeMinutes * MS_PER_MINUTE) {
    throw invalidTime(`Bookings must be made at least ${BOOKING_RULES.minNoticeMinutes} minutes in advance`);
  }
  if (start > current + BOOKING_RULES.maxAdvanceDays * MS_PER_DAY) {
    throw invalidTime(`Bookings can be made at most ${BOOKING_RULES.maxAdvanceDays} days in advance`);
  }
}

// The booking rules the server enforces (server/src/bookings/rules.ts, BOOKING_RULES), repeated here so the form can say
// "choose a later time" before any request is made. The server stays the authority: if these ever disagree, the server's
// answer wins and the page shows its error. `npm run check:time-conversion` fails if the two copies drift apart.
export const BOOKING_LIMITS = {
  minDurationMinutes: 30,
  maxDurationMinutes: 240,
  // Start times and durations move in steps of this many minutes.
  slotMinutes: 15,
  minPartySize: 1,
  maxPartySize: 20,
  // A booking must start at least this long from now, and no further ahead than this.
  minNoticeMinutes: 60,
  maxAdvanceDays: 90,
} as const;

const range = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

const pad = (value: number): string => String(value).padStart(2, '0');

// "00:00", "00:15", ... "23:45": 96 values. These are the values the <select> submits; labels are formatted for people.
export const START_TIME_VALUES: readonly string[] = range(0, 24 * 60 - BOOKING_LIMITS.slotMinutes, BOOKING_LIMITS.slotMinutes).map(
  (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
);

// 30, 45, ... 240 minutes, and 1..20 guests, as the strings a <select> and a URL carry.
export const DURATION_VALUES: readonly string[] = range(
  BOOKING_LIMITS.minDurationMinutes,
  BOOKING_LIMITS.maxDurationMinutes,
  BOOKING_LIMITS.slotMinutes,
).map(String);

export const PARTY_SIZE_VALUES: readonly string[] = range(BOOKING_LIMITS.minPartySize, BOOKING_LIMITS.maxPartySize, 1).map(String);

// 90 -> "1 h 30 min", 60 -> "1 h", 45 -> "45 min"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

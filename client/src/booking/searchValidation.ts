import type { AvailabilityQuery } from '../api/endpoints';
import { BOOKING_LIMITS, DURATION_VALUES, PARTY_SIZE_VALUES, START_TIME_VALUES } from './bookingLimits';
import type { SearchValues } from './searchParams';
import { localDateString, localSlotToUtc, type SlotConversion } from './timeConversion';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export type SearchErrors = { date?: string; time?: string; duration?: string; party?: string };

export type ValidSearch = {
  slot: Extract<SlotConversion, { ok: true }>;
  durationMinutes: number;
  partySize: number;
  // Exactly what GET /tables/availability expects (UTC date and time).
  query: AvailabilityQuery;
};

// Friendly checks before any request. Mirrors the server's rules (assertBookable + the query schema); the server decides in
// the end, so a wrong device clock only means a server error is shown later instead of this message. `now` is a parameter
// so the checks can be tested with a fixed clock.
export function validateSearch(
  values: SearchValues,
  now: Date = new Date(),
): { ok: true; search: ValidSearch } | { ok: false; errors: SearchErrors } {
  const shapeErrors: SearchErrors = {
    ...(values.date === '' ? { date: 'Choose a date.' } : {}),
    ...(!START_TIME_VALUES.includes(values.time) ? { time: 'Choose a start time.' } : {}),
    ...(!DURATION_VALUES.includes(values.duration) ? { duration: 'Choose how long you will stay.' } : {}),
    ...(!PARTY_SIZE_VALUES.includes(values.party) ? { party: 'Choose the number of guests.' } : {}),
  };

  const conversion = shapeErrors.date || shapeErrors.time ? null : localSlotToUtc({ date: values.date, time: values.time });
  const timeErrors: SearchErrors = conversion === null ? {} : errorsForSlot(conversion, values.date, now);

  const errors: SearchErrors = { ...shapeErrors, ...timeErrors };
  if (conversion === null || !conversion.ok || Object.keys(errors).length > 0) return { ok: false, errors };

  const durationMinutes = Number(values.duration);
  const partySize = Number(values.party);
  return {
    ok: true,
    search: {
      slot: conversion,
      durationMinutes,
      partySize,
      query: { date: conversion.utcDate, startTime: conversion.utcTime, durationMinutes, partySize },
    },
  };
}

function errorsForSlot(conversion: SlotConversion, localDate: string, now: Date): SearchErrors {
  if (!conversion.ok) {
    return conversion.reason === 'nonexistent'
      ? { time: "That time doesn't exist on that day because the clocks change. Please choose another time." }
      : { date: 'Enter a valid date.' };
  }
  const start = conversion.instant.getTime();
  const current = now.getTime();

  if (localDate < localDateString(now)) return { date: 'Choose today or a later date.' };
  if (start <= current) return { time: 'That time has already passed. Choose a later time.' };
  // Boundaries are inclusive, as on the server: exactly the minimum notice, or exactly the maximum advance, is allowed.
  if (start < current + BOOKING_LIMITS.minNoticeMinutes * MS_PER_MINUTE) {
    return { time: `Bookings need at least ${BOOKING_LIMITS.minNoticeMinutes} minutes' notice. Choose a later time.` };
  }
  if (start > current + BOOKING_LIMITS.maxAdvanceDays * MS_PER_DAY) {
    return { date: `Bookings can be made at most ${BOOKING_LIMITS.maxAdvanceDays} days ahead. Choose an earlier date.` };
  }
  return {};
}

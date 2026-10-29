import { z } from 'zod';
import { BOOKING_RULES, MS_PER_MINUTE } from './rules';

const { minDurationMinutes, maxDurationMinutes, slotMinutes, minPartySize, maxPartySize } = BOOKING_RULES;

// "19:00" -> 24-hour HH:mm, no seconds.
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Whole numbers within bounds. Used as-is for JSON bodies (where "4" must be rejected) and behind
// z.coerce.number() for query strings (where every value arrives as text).
// The step check sits behind .pipe() so it only runs once the range check has passed. Without it, a value
// like 241 fails both checks and the client gets two messages for one field.
const durationMinutesRule = z
  .number()
  .int()
  .min(minDurationMinutes)
  .max(maxDurationMinutes)
  .pipe(z.number().refine((minutes) => minutes % slotMinutes === 0, `durationMinutes must be a multiple of ${slotMinutes}`));

const partySizeRule = z.number().int().min(minPartySize).max(maxPartySize);

// An instant on the slot grid. Checking the epoch time also rejects stray seconds and milliseconds.
function isOnSlotGrid(instant: Date): boolean {
  return instant.getTime() % (slotMinutes * MS_PER_MINUTE) === 0;
}

// ISO 8601 date-time that MUST carry "Z" or an explicit offset ("+02:00"); "2026-11-03T19:00:00" is
// rejected because without a zone it is ambiguous. Parsed into one absolute instant, so a Date holds UTC.
const startsAtSchema = z.iso
  .datetime({ offset: true })
  .transform((text) => new Date(text))
  .refine(isOnSlotGrid, `startsAt must fall on a ${slotMinutes}-minute boundary`);

// date + startTime are UTC (decision for this project): "2026-11-03" + "19:00" -> 2026-11-03T19:00:00Z.
// Both parts are validated first, so the string is always a real date and the Date cannot be invalid.
function utcInstant(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime}:00.000Z`);
}

export const availabilityQuerySchema = z
  .object({
    // z.iso.date() checks the calendar, so "2026-02-30" is rejected.
    date: z.iso.date(),
    // Format first, then the grid check (via .pipe, so it never reads minutes out of a malformed string).
    startTime: z
      .string()
      .regex(HH_MM, 'startTime must be HH:mm (24-hour, UTC)')
      .pipe(
        z
          .string()
          .refine((time) => Number(time.slice(3)) % slotMinutes === 0, `startTime must fall on a ${slotMinutes}-minute boundary`),
      ),
    durationMinutes: z.coerce.number().pipe(durationMinutesRule),
    partySize: z.coerce.number().pipe(partySizeRule),
  })
  .transform(({ date, startTime, durationMinutes, partySize }) => ({
    startsAt: utcInstant(date, startTime),
    durationMinutes,
    partySize,
  }));

export const createBookingSchema = z.object({
  tableId: z.uuid(),
  startsAt: startsAtSchema,
  durationMinutes: durationMinutesRule,
  partySize: partySizeRule,
});

export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;
export type CreateBookingInput = z.output<typeof createBookingSchema>;

export const bookingIdParamsSchema = z.object({ id: z.uuid() });

import { z } from 'zod';

// Shapes of what the server sends, written from the server's real responses. Every response is parsed against one of
// these, so a mismatch between client and server shows up as one clear BAD_RESPONSE error instead of a crash in a
// component. Timestamps are UTC ISO strings ("2026-11-03T19:00:00.000Z"); they are converted to local time only for display.

const roleSchema = z.enum(['USER', 'ADMIN']);
const isoTimestamp = z.iso.datetime();

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});

// POST /auth/register and POST /auth/login
export const authResponseSchema = z.object({ token: z.string(), user: authUserSchema });

// GET /auth/me returns no `name`, so it has its own, smaller user shape.
export const currentUserSchema = z.object({ id: z.string(), email: z.string(), role: roleSchema });
export const meResponseSchema = z.object({ user: currentUserSchema });

export const availableTableSchema = z.object({ id: z.string(), name: z.string(), capacity: z.number().int() });
export const availabilityResponseSchema = z.object({ tables: z.array(availableTableSchema) });

const bookingStatusSchema = z.enum(['CONFIRMED', 'CANCELLED']);

// POST /bookings and PATCH /bookings/:id/cancel
export const bookingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tableId: z.string(),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp,
  partySize: z.number().int(),
  status: bookingStatusSchema,
  createdAt: isoTimestamp,
});
export const bookingResponseSchema = z.object({ booking: bookingSchema });

// One row of GET /bookings/me: no userId (always the caller), plus the table's id and name.
export const myBookingSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp,
  partySize: z.number().int(),
  status: bookingStatusSchema,
  createdAt: isoTimestamp,
  table: z.object({ id: z.string(), name: z.string() }),
});
export const myBookingsResponseSchema = z.object({
  data: z.array(myBookingSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

// The server's error shape for every failure: { "error": { "code": "...", "message": "..." } }
export const apiErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type Role = z.output<typeof roleSchema>;
export type AuthUser = z.output<typeof authUserSchema>;
export type AuthResponse = z.output<typeof authResponseSchema>;
export type CurrentUser = z.output<typeof currentUserSchema>;
export type AvailableTable = z.output<typeof availableTableSchema>;
export type Booking = z.output<typeof bookingSchema>;
export type MyBooking = z.output<typeof myBookingSchema>;
export type MyBookingsPage = z.output<typeof myBookingsResponseSchema>;

import type { RequestFn } from './client';
import {
  authResponseSchema,
  availabilityResponseSchema,
  bookingResponseSchema,
  meResponseSchema,
  myBookingsResponseSchema,
  type AuthResponse,
  type AvailableTable,
  type Booking,
  type CurrentUser,
  type MyBookingsPage,
} from './schemas';

export type RegisterInput = { email: string; password: string; name: string };
export type LoginInput = { email: string; password: string };
// date is YYYY-MM-DD and startTime is HH:mm, both in UTC, exactly as the API expects.
export type AvailabilityQuery = { date: string; startTime: string; durationMinutes: number; partySize: number };
// startsAt is an ISO 8601 timestamp with Z or an offset.
export type CreateBookingInput = { tableId: string; startsAt: string; durationMinutes: number; partySize: number };

// One function per API endpoint. Pages call these and never use fetch themselves, so URLs, auth headers, error
// handling and response checking live in one place. They take the `request` function as an argument (instead of
// importing a global one) so tests can supply a fake; src/api/index.ts will wire in the real one.
export function createEndpoints(request: RequestFn) {
  return {
    register: (input: RegisterInput, signal?: AbortSignal): Promise<AuthResponse> =>
      request('/auth/register', { method: 'POST', body: input, schema: authResponseSchema, signal }),

    login: (input: LoginInput, signal?: AbortSignal): Promise<AuthResponse> =>
      request('/auth/login', { method: 'POST', body: input, schema: authResponseSchema, signal }),

    getMe: async (signal?: AbortSignal): Promise<CurrentUser> =>
      (await request('/auth/me', { schema: meResponseSchema, signal })).user,

    getAvailability: async (query: AvailabilityQuery, signal?: AbortSignal): Promise<AvailableTable[]> =>
      (await request('/tables/availability', { query, schema: availabilityResponseSchema, signal })).tables,

    createBooking: async (input: CreateBookingInput, signal?: AbortSignal): Promise<Booking> =>
      (await request('/bookings', { method: 'POST', body: input, schema: bookingResponseSchema, signal })).booking,

    listMyBookings: (
      { page, pageSize }: { page?: number; pageSize?: number } = {},
      signal?: AbortSignal,
    ): Promise<MyBookingsPage> =>
      request('/bookings/me', { query: { page, pageSize }, schema: myBookingsResponseSchema, signal }),

    cancelBooking: async (bookingId: string, signal?: AbortSignal): Promise<Booking> =>
      (
        await request(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
          method: 'PATCH',
          schema: bookingResponseSchema,
          signal,
        })
      ).booking,
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;

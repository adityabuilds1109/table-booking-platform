import { z } from 'zod';
import { AppError } from '../errors';
import type { Booking, Prisma, Role } from '../generated/prisma/client';
import { toPage, toSkipTake, type Page, type PaginationQuery } from '../lib/pagination';
import { prisma } from '../lib/prisma';
import { assertBookable, endsAtFor } from './rules';
import type { AvailabilityQuery, CreateBookingInput } from './schemas';

export type AvailableTable = { id: string; name: string; capacity: number };

// Active tables that fit the party and have no CONFIRMED booking overlapping [startsAt, startsAt + duration).
// Overlap is the standard half-open test (existing starts before we end AND ends after we start), the same
// rule as the booking_no_overlap constraint, so a booking ending exactly when ours starts does not block it.
// Advisory only: another request can take the table a moment later, so POST /bookings re-checks under a lock.
export async function listAvailableTables({
  startsAt,
  durationMinutes,
  partySize,
}: AvailabilityQuery): Promise<AvailableTable[]> {
  const endsAt = endsAtFor(startsAt, durationMinutes);

  return prisma.table.findMany({
    where: {
      isActive: true,
      capacity: { gte: partySize },
      bookings: {
        none: { status: 'CONFIRMED', startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      },
    },
    // Smallest table that fits first, so the client's first suggestion doesn't waste a big table.
    orderBy: [{ capacity: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, capacity: true },
  });
}

// Shape of the row the locking query returns. Raw queries come back untyped, so it is parsed, not cast.
const lockedTableRows = z.array(z.object({ capacity: z.number().int(), isActive: z.boolean() }));

// Same wording as the errorHandler's exclusion-constraint path, so a client sees one SLOT_TAKEN whichever check caught it.
function slotTaken(): AppError {
  return new AppError(409, 'SLOT_TAKEN', 'This table is already booked for the requested time');
}

// Creates a CONFIRMED booking for `userId`. Throws AppError for every rule violation.
//
// Concurrency: the Table row is locked first (SELECT ... FOR UPDATE). A second request for the same table waits
// at that statement until the first transaction commits or rolls back. Postgres' default isolation (READ
// COMMITTED) gives each later statement a fresh snapshot, so once the waiter is released, the overlap check below
// sees the winner's committed booking and rejects cleanly. The booking_no_overlap exclusion constraint stays as the
// safety net; if it ever fires here, the lock is not doing its job (a test asserts it never does).
// Locking the Table row (not Booking rows) works because a free slot has no rows to lock yet; the table is the one
// thing every competing request has in common. Different tables never block each other.
export async function createBooking(
  { tableId, startsAt, durationMinutes, partySize }: CreateBookingInput,
  userId: string,
  now: Date = new Date(),
): Promise<Booking> {
  // Time rules first: they need no database, so a bad request never takes a lock.
  assertBookable(startsAt, now);
  const endsAt = endsAtFor(startsAt, durationMinutes);

  return prisma.$transaction(async (tx) => {
    // ${tableId} is sent as a bound parameter, not spliced into the SQL. "Table" is quoted because it is a reserved word.
    const rows = lockedTableRows.parse(
      await tx.$queryRaw`SELECT capacity, "isActive" FROM "Table" WHERE id = ${tableId} FOR UPDATE`,
    );
    const table = rows[0];
    if (!table) {
      throw new AppError(404, 'NOT_FOUND', 'Table not found');
    }
    if (!table.isActive) {
      throw new AppError(409, 'TABLE_INACTIVE', 'This table is not available for booking');
    }
    if (table.capacity < partySize) {
      throw new AppError(422, 'CAPACITY_EXCEEDED', `This table seats at most ${table.capacity} guests`);
    }

    const overlapping = await tx.booking.findFirst({
      where: { tableId, status: 'CONFIRMED', startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      select: { id: true },
    });
    if (overlapping) {
      throw slotTaken();
    }

    return tx.booking.create({ data: { userId, tableId, startsAt, endsAt, partySize } });
  });
}

// What a diner sees in their own booking list. No userId (it is always the caller), and only the table's id and name.
const myBookingSelect = {
  id: true,
  tableId: true,
  startsAt: true,
  endsAt: true,
  partySize: true,
  status: true,
  createdAt: true,
  table: { select: { id: true, name: true } },
} satisfies Prisma.BookingSelect;

export type MyBooking = Prisma.BookingGetPayload<{ select: typeof myBookingSelect }>;

// The caller's bookings (every status, so cancelled ones stay visible as history), latest start first.
export async function listMyBookings(userId: string, pagination: PaginationQuery): Promise<Page<MyBooking>> {
  const where = { userId };

  // One batch transaction so the rows and the total come from the same moment. REPEATABLE READ is what makes that true:
  // under the default READ COMMITTED each statement takes its own snapshot, and a booking created between the two
  // queries could make `total` disagree with `data`.
  const [data, total] = await prisma.$transaction(
    [
      prisma.booking.findMany({
        where,
        // `id` is a tie-breaker: without it, bookings with the same startsAt (different tables) can swap places between
        // requests, so a page boundary could repeat one booking and skip another.
        orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(pagination),
        select: myBookingSelect,
      }),
      prisma.booking.count({ where }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );

  return toPage(data, total, pagination);
}

// Who is asking to cancel. Comes from `authenticate`, so the role is the one in the database, not the token.
export type Actor = { id: string; role: Role };

// Cancels a booking. The owner or an admin may do it; everyone else gets 403.
//
// Check order matters. Existence and ownership come first, so a stranger learns nothing about a booking's status.
// Then "already cancelled" returns the booking unchanged (idempotent: repeating the request, or a retry after a
// network error, is harmless). Only then the "already started" rule, so an old cancelled booking still answers 200.
// The slot frees itself: the booking_no_overlap constraint and the availability query both ignore CANCELLED rows.
export async function cancelBooking(bookingId: string, actor: Actor, now: Date = new Date()): Promise<Booking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  if (booking.userId !== actor.id && actor.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own bookings');
  }
  if (booking.status === 'CANCELLED') {
    return booking;
  }
  if (booking.startsAt.getTime() <= now.getTime()) {
    throw new AppError(409, 'BOOKING_STARTED', 'A booking that has already started cannot be cancelled');
  }

  // Safe without a lock: CONFIRMED -> CANCELLED is the only transition, and two concurrent cancels end in the same state.
  return prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
}

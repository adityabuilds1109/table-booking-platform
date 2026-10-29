import { z } from 'zod';
import { AppError } from '../errors';
import type { Booking } from '../generated/prisma/client';
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

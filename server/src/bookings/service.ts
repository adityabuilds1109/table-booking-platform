import { prisma } from '../lib/prisma';
import { endsAtFor } from './rules';
import type { AvailabilityQuery } from './schemas';

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

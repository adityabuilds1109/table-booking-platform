import { randomUUID } from 'node:crypto';
import type { BookingStatus } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

// Rows inserted straight through Prisma, for arranging test data without going through the API.

export function createUser() {
  // The hash is never checked in these tests, so it doesn't need to be a real bcrypt hash.
  return prisma.user.create({
    data: { email: `${randomUUID()}@example.com`, passwordHash: 'not-a-real-hash', name: 'Test User' },
  });
}

export function createTable({
  name = randomUUID().slice(0, 8),
  capacity = 4,
  isActive = true,
}: { name?: string; capacity?: number; isActive?: boolean } = {}) {
  return prisma.table.create({ data: { name, capacity, isActive } });
}

export function createBooking({
  userId,
  tableId,
  startsAt,
  endsAt,
  partySize = 2,
  status = 'CONFIRMED',
}: {
  userId: string;
  tableId: string;
  startsAt: Date;
  endsAt: Date;
  partySize?: number;
  status?: BookingStatus;
}) {
  return prisma.booking.create({ data: { userId, tableId, startsAt, endsAt, partySize, status } });
}

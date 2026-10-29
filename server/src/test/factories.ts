import { randomUUID } from 'node:crypto';
import { signToken } from '../auth/token';
import type { BookingStatus, Role } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

// ['Authorization', 'Bearer <jwt>'] for supertest's `.set(...)`, signed like a real login would.
export function authHeaderFor(user: { id: string; role: Role }): [string, string] {
  return ['Authorization', `Bearer ${signToken(user)}`];
}

// Rows inserted straight through Prisma, for arranging test data without going through the API.

export function createUser({ role = 'USER' }: { role?: Role } = {}) {
  // The hash is never checked in these tests, so it doesn't need to be a real bcrypt hash.
  return prisma.user.create({
    data: { email: `${randomUUID()}@example.com`, passwordHash: 'not-a-real-hash', name: 'Test User', role },
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

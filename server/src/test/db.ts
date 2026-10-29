import { prisma } from '../lib/prisma';
import { assertTestDatabaseUrl } from './assertTestDatabase';

// Empties every table. Re-checks the database name itself (not just in setupEnv), so a wrong
// DATABASE_URL can never be wiped even if someone bypasses the Jest setup file.
export async function resetDatabase(): Promise<void> {
  assertTestDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL');
  // CASCADE because Booking has foreign keys to User and Table.
  await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Table", "User" CASCADE`;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

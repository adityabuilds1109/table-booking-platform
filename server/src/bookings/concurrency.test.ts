import request from 'supertest';
import { z } from 'zod';
import app from '../app';
import { prisma } from '../lib/prisma';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { authHeaderFor, createTable, createUser } from '../test/factories';
import { utcDateAt } from '../test/slots';
import { createBooking } from './service';

// How many requests fight for the same slot. Kept below the pg connection pool's default max of 10: every
// request holds a connection while it waits for the table lock, so with more requests than connections the extras
// would queue for a connection instead of racing, which makes the race weaker.
const PARALLEL_REQUESTS = 8;

// Logged by the error handler ONLY when the booking_no_overlap exclusion constraint rejected an insert.
const CONSTRAINT_LOG = 'Booking overlap rejected by database:';

const startsAt = utcDateAt(7, 19);
const bookingInput = (tableId: string) => ({ tableId, startsAt, durationMinutes: 90, partySize: 2 });

const errorBodySchema = z.object({ error: z.object({ code: z.string() }) });

// A promise plus the function that settles it, so a test can pause and resume another piece of code.
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

// Opens a transaction that locks the table row and holds it until `release()` is called: a stand-in for a
// slow in-flight booking, so tests can observe what a competing request does while the lock is held.
//
// FOR NO KEY UPDATE, not FOR UPDATE, on purpose. Inserting a Booking takes a weaker FOR KEY SHARE lock on its Table
// row (the foreign key does that). FOR UPDATE conflicts with it, so an insert would block behind this holder even if
// createBooking never asked for a lock, and the test would pass without proving anything. FOR NO KEY UPDATE does not
// conflict with the foreign key's lock but does conflict with createBooking's FOR UPDATE, so only a real
// SELECT ... FOR UPDATE in createBooking can make it wait.
function holdTableLock(tableId: string) {
  const acquired = deferred();
  const released = deferred();
  const finished = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR NO KEY UPDATE`;
    acquired.resolve();
    await released.promise;
  });
  // Race with `finished` so a failure to even start the transaction fails the test instead of hanging it.
  const lockHeld = Promise.race([acquired.promise, finished]);
  return { lockHeld, release: released.resolve, finished };
}

let consoleError: jest.SpyInstance;

beforeEach(async () => {
  await resetDatabase();
  // Silences the error handler's logging and lets tests inspect what it logged.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

afterAll(disconnectDatabase);

describe('booking concurrency', () => {
  it(`${PARALLEL_REQUESTS} parallel requests for one slot: exactly one 201, the rest 409, rejected by the app check, not the constraint`, async () => {
    // Arrange
    const table = await createTable({ capacity: 4 });
    const users = await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, () => createUser()));

    // Act: everyone fires at once, each as a different authenticated user.
    const responses = await Promise.all(
      users.map((user) =>
        request(app)
          .post('/bookings')
          .set(...authHeaderFor(user))
          .send({ tableId: table.id, startsAt: startsAt.toISOString(), durationMinutes: 90, partySize: 2 }),
      ),
    );

    // Assert: outcomes
    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([201, ...Array<number>(PARALLEL_REQUESTS - 1).fill(409)]);
    for (const res of responses.filter((r) => r.status === 409)) {
      expect(errorBodySchema.parse(res.body).error.code).toBe('SLOT_TAKEN');
    }
    expect(await prisma.booking.count({ where: { tableId: table.id, status: 'CONFIRMED' } })).toBe(1);

    // Assert: HOW the losers were rejected. "Exactly one winner" alone would also hold without the lock, because the
    // exclusion constraint would reject the extras. With the lock they wait, then the app check sees the winner's row,
    // so the constraint is never reached and its log line never appears.
    const constraintRejections = consoleError.mock.calls.filter(([message]) => message === CONSTRAINT_LOG);
    expect(constraintRejections).toHaveLength(0);
    expect(consoleError).not.toHaveBeenCalled(); // and no request ended in an unexpected 500
  });

  it('blocks a booking for a table while another transaction holds that table row locked', async () => {
    // Arrange
    const user = await createUser();
    const table = await createTable({ capacity: 4 });
    const holder = holdTableLock(table.id);
    await holder.lockHeld;

    // Act: start a booking while the lock is held and watch whether it finishes.
    let finishedWhileLocked = false;
    const pending = createBooking(bookingInput(table.id), user.id).finally(() => {
      finishedWhileLocked = true;
    });
    await sleep(300);
    const settledWhileLocked = finishedWhileLocked;
    const rowsWhileLocked = await prisma.booking.count();

    holder.release();
    await holder.finished;
    const booking = await pending;

    // Assert
    expect(settledWhileLocked).toBe(false);
    expect(rowsWhileLocked).toBe(0);
    expect(booking.tableId).toBe(table.id);
    expect(await prisma.booking.count()).toBe(1);
  });

  it('does not block a booking for a different table', async () => {
    // Arrange
    const user = await createUser();
    const lockedTable = await createTable({ name: 'locked' });
    const otherTable = await createTable({ name: 'other' });
    const holder = holdTableLock(lockedTable.id);
    await holder.lockHeld;

    // Act
    const outcome = await Promise.race([
      createBooking(bookingInput(otherTable.id), user.id).then(() => 'booked' as const),
      sleep(2000).then(() => 'blocked' as const),
    ]);
    holder.release();
    await holder.finished;

    // Assert
    expect(outcome).toBe('booked');
  });

  it('lets the waiting request fail with SLOT_TAKEN once the lock holder commits a conflicting booking', async () => {
    // Arrange: a first booking is created inside a transaction that keeps the lock, a second request waits behind it.
    const first = await createUser();
    const second = await createUser();
    const table = await createTable({ capacity: 4 });
    const holder = deferred();
    const firstHasLock = deferred();
    const firstTransaction = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${table.id} FOR UPDATE`;
      await tx.booking.create({
        data: {
          userId: first.id,
          tableId: table.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 90 * 60_000),
          partySize: 2,
        },
      });
      firstHasLock.resolve();
      await holder.promise;
    });
    await Promise.race([firstHasLock.promise, firstTransaction]);

    // Act: the second request starts while the first transaction is open (its row is not committed yet).
    const waiting = createBooking(bookingInput(table.id), second.id);
    const waitingOutcome = waiting.then(
      () => 'booked',
      (err: unknown) => (err instanceof Error ? err.message : 'unknown error'),
    );
    await sleep(200);
    holder.resolve();
    await firstTransaction;

    // Assert: it was rejected by the app check (an AppError), after waiting, and never reached the constraint.
    expect(await waitingOutcome).toBe('This table is already booked for the requested time');
    expect(consoleError).not.toHaveBeenCalled();
    expect(await prisma.booking.count()).toBe(1);
  });
});

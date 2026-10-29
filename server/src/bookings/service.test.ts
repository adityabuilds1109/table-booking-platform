import { AppError } from '../errors';
import { prisma } from '../lib/prisma';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { createBooking as insertBooking, createTable, createUser } from '../test/factories';
import { utcDateAt } from '../test/slots';
import { BOOKING_RULES, MS_PER_MINUTE } from './rules';
import { cancelBooking, createBooking } from './service';

const startsAt = utcDateAt(7, 19);

function minutesBefore(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * MS_PER_MINUTE);
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

// The HTTP tests use the real clock; these pin it with the `now` parameter to hit the exact boundaries.
describe('createBooking time rules (injected clock)', () => {
  async function arrange() {
    return { user: await createUser(), table: await createTable({ capacity: 4 }) };
  }

  it('accepts a start exactly at the minimum notice', async () => {
    // Arrange
    const { user, table } = await arrange();
    const now = minutesBefore(startsAt, BOOKING_RULES.minNoticeMinutes);

    // Act
    const booking = await createBooking({ tableId: table.id, startsAt, durationMinutes: 60, partySize: 2 }, user.id, now);

    // Assert
    expect(booking.startsAt).toEqual(startsAt);
  });

  it('rejects a start one minute inside the minimum notice, without storing anything', async () => {
    // Arrange
    const { user, table } = await arrange();
    const now = minutesBefore(startsAt, BOOKING_RULES.minNoticeMinutes - 1);

    // Act
    const attempt = createBooking({ tableId: table.id, startsAt, durationMinutes: 60, partySize: 2 }, user.id, now);

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ status: 422, code: 'BOOKING_TIME_INVALID' });
    expect(await prisma.booking.count()).toBe(0);
  });

  it('rejects the time rules before looking at the table, so an unknown table id still reports the time error', async () => {
    const { user } = await arrange();
    const now = new Date(startsAt.getTime() + MS_PER_MINUTE);

    const attempt = createBooking(
      { tableId: '00000000-0000-4000-8000-000000000000', startsAt, durationMinutes: 60, partySize: 2 },
      user.id,
      now,
    );

    await expect(attempt).rejects.toMatchObject({ code: 'BOOKING_TIME_INVALID' });
  });
});

// Same idea as above: the HTTP tests use the real clock, so the exact "has it started" boundary is pinned here.
describe('cancelBooking started boundary (injected clock)', () => {
  async function arrangeBooking() {
    const user = await createUser();
    const table = await createTable({ capacity: 4 });
    const booking = await insertBooking({
      userId: user.id,
      tableId: table.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * MS_PER_MINUTE),
    });
    return { user, booking };
  }

  it('allows cancelling one millisecond before the start', async () => {
    const { user, booking } = await arrangeBooking();

    const cancelled = await cancelBooking(booking.id, user, new Date(startsAt.getTime() - 1));

    expect(cancelled.status).toBe('CANCELLED');
  });

  it('rejects cancelling at the exact start instant', async () => {
    const { user, booking } = await arrangeBooking();

    const attempt = cancelBooking(booking.id, user, startsAt);

    await expect(attempt).rejects.toMatchObject({ status: 409, code: 'BOOKING_STARTED' });
  });
});

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import app from '../app';
import { MS_PER_MINUTE } from '../bookings/rules';
import { prisma } from '../lib/prisma';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { authHeaderFor, createBooking, createTable, createUser } from '../test/factories';
import { utcDateAt } from '../test/slots';

const cancelResponseSchema = z.object({
  booking: z.object({ id: z.string(), userId: z.string(), tableId: z.string(), status: z.enum(['CONFIRMED', 'CANCELLED']) }),
});

type User = Awaited<ReturnType<typeof createUser>>;
type Table = Awaited<ReturnType<typeof createTable>>;

const BOOKING_MINUTES = 90;
const slotStart = utcDateAt(7, 19);

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * MS_PER_MINUTE);
}

// A booking for the standard slot (19:00-20:30 UTC a week ahead) unless a different start is given.
function bookFor(user: User, table: Table, { startsAt = slotStart, status = 'CONFIRMED' as 'CONFIRMED' | 'CANCELLED' } = {}) {
  return createBooking({
    userId: user.id,
    tableId: table.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + BOOKING_MINUTES * MS_PER_MINUTE),
    status,
  });
}

function cancel(user: User, bookingId: string) {
  return request(app)
    .patch(`/bookings/${bookingId}/cancel`)
    .set(...authHeaderFor(user));
}

async function statusInDb(bookingId: string) {
  return (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('PATCH /bookings/:id/cancel', () => {
  describe('authentication and input', () => {
    it('returns 401 without a token and leaves the booking alone', async () => {
      // Arrange
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable());

      // Act
      const res = await request(app).patch(`/bookings/${booking.id}/cancel`);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
      expect(await statusInDb(booking.id)).toBe('CONFIRMED');
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).patch(`/bookings/${randomUUID()}/cancel`).set('Authorization', 'Bearer not.a.token');

      expect(res.status).toBe(401);
    });

    it('returns 400 VALIDATION_ERROR when the id is not a UUID', async () => {
      const user = await createUser();

      const res = await cancel(user, 'not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(JSON.stringify(res.body)).toContain('id:');
    });

    it('returns 401, not a validation error, for an anonymous caller with a bad id', async () => {
      const res = await request(app).patch('/bookings/not-a-uuid/cancel');

      expect(res.status).toBe(401);
    });
  });

  it('returns 404 NOT_FOUND for a booking that does not exist', async () => {
    const user = await createUser();

    const res = await cancel(user, randomUUID());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
  });

  describe('who may cancel', () => {
    it('lets the owner cancel: 200, status CANCELLED, stored', async () => {
      // Arrange
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable());

      // Act
      const res = await cancel(owner, booking.id);

      // Assert
      expect(res.status).toBe(200);
      expect(cancelResponseSchema.parse(res.body).booking).toMatchObject({
        id: booking.id,
        userId: owner.id,
        status: 'CANCELLED',
      });
      expect(await statusInDb(booking.id)).toBe('CANCELLED');
    });

    it('returns 403 FORBIDDEN to another user and leaves the booking CONFIRMED', async () => {
      // Arrange
      const owner = await createUser();
      const stranger = await createUser();
      const booking = await bookFor(owner, await createTable());

      // Act
      const res = await cancel(stranger, booking.id);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own bookings' } });
      expect(await statusInDb(booking.id)).toBe('CONFIRMED');
    });

    it("tells a stranger nothing about the booking's state: 403 even when it is already cancelled or already started", async () => {
      // Arrange
      const owner = await createUser();
      const stranger = await createUser();
      const table = await createTable();
      const cancelled = await bookFor(owner, table, { status: 'CANCELLED' });
      const started = await bookFor(owner, table, { startsAt: minutesFromNow(-30) });

      // Act
      const onCancelled = await cancel(stranger, cancelled.id);
      const onStarted = await cancel(stranger, started.id);

      // Assert
      expect([onCancelled.status, onStarted.status]).toEqual([403, 403]);
    });

    it("lets an admin cancel someone else's booking", async () => {
      // Arrange
      const owner = await createUser();
      const admin = await createUser({ role: 'ADMIN' });
      const booking = await bookFor(owner, await createTable());

      // Act
      const res = await cancel(admin, booking.id);

      // Assert
      expect(res.status).toBe(200);
      expect(cancelResponseSchema.parse(res.body).booking).toMatchObject({ userId: owner.id, status: 'CANCELLED' });
      expect(await statusInDb(booking.id)).toBe('CANCELLED');
    });

    it('takes the role from the database: a user demoted after login loses admin rights at once', async () => {
      // Arrange: token issued while ADMIN, then demoted.
      const owner = await createUser();
      const wasAdmin = await createUser({ role: 'ADMIN' });
      const booking = await bookFor(owner, await createTable());
      const headerWhileAdmin = authHeaderFor(wasAdmin);
      await prisma.user.update({ where: { id: wasAdmin.id }, data: { role: 'USER' } });

      // Act
      const res = await request(app)
        .patch(`/bookings/${booking.id}/cancel`)
        .set(...headerWhileAdmin);

      // Assert
      expect(res.status).toBe(403);
      expect(await statusInDb(booking.id)).toBe('CONFIRMED');
    });
  });

  describe('booking state', () => {
    it('is idempotent: cancelling an already CANCELLED booking returns 200 and leaves it CANCELLED', async () => {
      // Arrange
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable());

      // Act
      const first = await cancel(owner, booking.id);
      const second = await cancel(owner, booking.id);

      // Assert
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(cancelResponseSchema.parse(second.body).booking.status).toBe('CANCELLED');
      expect(await statusInDb(booking.id)).toBe('CANCELLED');
    });

    it('still answers 200 for a cancelled booking that is long past (idempotent beats "already started")', async () => {
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable(), { startsAt: utcDateAt(-10, 19), status: 'CANCELLED' });

      const res = await cancel(owner, booking.id);

      expect(res.status).toBe(200);
    });

    it('two simultaneous cancels both succeed and the booking ends up CANCELLED', async () => {
      // Arrange
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable());

      // Act
      const results = await Promise.all([cancel(owner, booking.id), cancel(owner, booking.id)]);

      // Assert
      expect(results.map((res) => res.status)).toEqual([200, 200]);
      expect(await statusInDb(booking.id)).toBe('CANCELLED');
    });

    it.each([
      ['one that started 30 minutes ago and is still running', -30],
      ['one that ended yesterday', -24 * 60],
    ])('returns 409 BOOKING_STARTED for %s and leaves it CONFIRMED', async (_label, startMinutesFromNow) => {
      // Arrange
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable(), { startsAt: minutesFromNow(startMinutesFromNow) });

      // Act
      const res = await cancel(owner, booking.id);

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'BOOKING_STARTED', message: 'A booking that has already started cannot be cancelled' },
      });
      expect(await statusInDb(booking.id)).toBe('CONFIRMED');
    });

    it('applies the "already started" rule to admins too', async () => {
      const owner = await createUser();
      const admin = await createUser({ role: 'ADMIN' });
      const booking = await bookFor(owner, await createTable(), { startsAt: minutesFromNow(-30) });

      const res = await cancel(admin, booking.id);

      expect(res.status).toBe(409);
    });

    it('allows cancelling a booking that starts in a few minutes', async () => {
      const owner = await createUser();
      const booking = await bookFor(owner, await createTable(), { startsAt: minutesFromNow(5) });

      const res = await cancel(owner, booking.id);

      expect(res.status).toBe(200);
    });

    it("cancels only the requested booking, not the owner's other ones", async () => {
      // Arrange
      const owner = await createUser();
      const table = await createTable();
      const target = await bookFor(owner, table);
      const other = await bookFor(owner, table, { startsAt: utcDateAt(8, 19) });

      // Act
      await cancel(owner, target.id);

      // Assert
      expect(await statusInDb(target.id)).toBe('CANCELLED');
      expect(await statusInDb(other.id)).toBe('CONFIRMED');
    });
  });

  describe('freeing the slot', () => {
    const slotBody = (tableId: string) => ({
      tableId,
      startsAt: slotStart.toISOString(),
      durationMinutes: BOOKING_MINUTES,
      partySize: 2,
    });

    it('cancel then rebook: the same user can book the same slot again', async () => {
      // Arrange
      const owner = await createUser();
      const table = await createTable();
      const book = () =>
        request(app)
          .post('/bookings')
          .set(...authHeaderFor(owner))
          .send(slotBody(table.id));

      // Act
      const first = await book();
      const rebookWhileConfirmed = await book();
      const cancelled = await cancel(owner, z.object({ booking: z.object({ id: z.string() }) }).parse(first.body).booking.id);
      const rebooked = await book();

      // Assert
      expect(first.status).toBe(201);
      expect(rebookWhileConfirmed.status).toBe(409);
      expect(cancelled.status).toBe(200);
      expect(rebooked.status).toBe(201);
      expect(await prisma.booking.count({ where: { tableId: table.id, status: 'CONFIRMED' } })).toBe(1);
      expect(await prisma.booking.count({ where: { tableId: table.id, status: 'CANCELLED' } })).toBe(1);
    });

    it('cancel then rebook: a different user can take the freed slot', async () => {
      // Arrange
      const owner = await createUser();
      const newcomer = await createUser();
      const table = await createTable();
      const booking = await bookFor(owner, table);
      await cancel(owner, booking.id);

      // Act
      const res = await request(app)
        .post('/bookings')
        .set(...authHeaderFor(newcomer))
        .send(slotBody(table.id));

      // Assert
      expect(res.status).toBe(201);
    });

    it('puts the table back in the availability results', async () => {
      // Arrange
      const owner = await createUser();
      const table = await createTable({ name: 'T1', capacity: 4 });
      const booking = await bookFor(owner, table);
      const query = {
        date: slotStart.toISOString().slice(0, 10),
        startTime: '19:00',
        durationMinutes: String(BOOKING_MINUTES),
        partySize: '2',
      };

      // Act
      const before = await request(app).get('/tables/availability').query(query);
      await cancel(owner, booking.id);
      const after = await request(app).get('/tables/availability').query(query);

      // Assert
      expect(before.body).toEqual({ tables: [] });
      expect(after.body).toMatchObject({ tables: [{ id: table.id, name: 'T1' }] });
    });
  });
});

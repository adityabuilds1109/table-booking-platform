import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import app from '../app';
import { MS_PER_MINUTE } from '../bookings/rules';
import { prisma } from '../lib/prisma';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { authHeaderFor, createBooking, createTable, createUser } from '../test/factories';
import { utcDateAt } from '../test/slots';

const bookingResponseSchema = z.object({
  booking: z.object({
    id: z.string(),
    userId: z.string(),
    tableId: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    partySize: z.number(),
    status: z.enum(['CONFIRMED', 'CANCELLED']),
  }),
});

// Every test books 19:00-20:30 UTC a week from today unless it says otherwise (see the same note in tables.test.ts).
const DURATION_MINUTES = 90;
const requestStart = utcDateAt(7, 19);

// Minutes relative to the slot's start: at(0) is 19:00, at(90) is 20:30.
function at(minutesFromRequestStart: number): Date {
  return new Date(requestStart.getTime() + minutesFromRequestStart * MS_PER_MINUTE);
}

function bodyFor(tableId: string, overrides: Record<string, unknown> = {}) {
  return { tableId, startsAt: at(0).toISOString(), durationMinutes: DURATION_MINUTES, partySize: 2, ...overrides };
}

function postBooking(user: Parameters<typeof authHeaderFor>[0], body: unknown) {
  return request(app)
    .post('/bookings')
    .set(...authHeaderFor(user))
    .send(body as object);
}

async function arrange(tableOverrides: Parameters<typeof createTable>[0] = {}) {
  const user = await createUser();
  const table = await createTable({ capacity: 4, ...tableOverrides });
  return { user, table };
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('POST /bookings', () => {
  describe('creating a booking', () => {
    it('returns 201 with the CONFIRMED booking and stores it', async () => {
      // Arrange
      const { user, table } = await arrange();

      // Act
      const res = await postBooking(user, bodyFor(table.id, { partySize: 3 }));

      // Assert
      expect(res.status).toBe(201);
      const { booking } = bookingResponseSchema.parse(res.body);
      expect(booking).toMatchObject({ tableId: table.id, partySize: 3, status: 'CONFIRMED' });
      expect(new Date(booking.startsAt)).toEqual(at(0));
      const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(stored).toMatchObject({ userId: user.id, tableId: table.id, partySize: 3, status: 'CONFIRMED' });
    });

    it('computes endsAt on the server from the duration', async () => {
      const { user, table } = await arrange();

      const res = await postBooking(user, bodyFor(table.id, { durationMinutes: 120 }));

      expect(new Date(bookingResponseSchema.parse(res.body).booking.endsAt)).toEqual(at(120));
    });

    it('stores the instant in UTC when the client sends an offset', async () => {
      // Arrange: 21:00 at +02:00 is 19:00 UTC.
      const { user, table } = await arrange();

      // Act
      const res = await postBooking(user, bodyFor(table.id, { startsAt: `${at(0).toISOString().slice(0, 11)}21:00:00+02:00` }));

      // Assert
      expect(res.status).toBe(201);
      expect(new Date(bookingResponseSchema.parse(res.body).booking.startsAt)).toEqual(at(0));
    });

    it('owns the booking by the authenticated user, ignoring userId/status/endsAt in the body', async () => {
      // Arrange
      const { user, table } = await arrange();
      const someoneElse = await createUser();

      // Act
      const res = await postBooking(
        user,
        bodyFor(table.id, { userId: someoneElse.id, status: 'CANCELLED', endsAt: at(600).toISOString() }),
      );

      // Assert
      expect(res.status).toBe(201);
      const { booking } = bookingResponseSchema.parse(res.body);
      expect(booking.userId).toBe(user.id);
      expect(booking.status).toBe('CONFIRMED');
      expect(new Date(booking.endsAt)).toEqual(at(DURATION_MINUTES));
    });

    it('accepts a party exactly as large as the table', async () => {
      const { user, table } = await arrange({ capacity: 4 });

      const res = await postBooking(user, bodyFor(table.id, { partySize: 4 }));

      expect(res.status).toBe(201);
    });

    it('lets two different tables be booked for the same slot', async () => {
      // Arrange
      const user = await createUser();
      const first = await createTable({ name: 'first' });
      const second = await createTable({ name: 'second' });

      // Act
      const a = await postBooking(user, bodyFor(first.id));
      const b = await postBooking(user, bodyFor(second.id));

      // Assert
      expect([a.status, b.status]).toEqual([201, 201]);
    });
  });

  describe('authentication', () => {
    it('returns 401 without a token and creates nothing', async () => {
      const { table } = await arrange();

      const res = await request(app).post('/bookings').send(bodyFor(table.id));

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
      expect(await prisma.booking.count()).toBe(0);
    });

    it('returns 401, not a validation error, for an anonymous caller with a bad body', async () => {
      const res = await request(app).post('/bookings').send({});

      expect(res.status).toBe(401);
    });
  });

  describe('conflicts', () => {
    // The existing booking is 19:00-20:30; each row is a request that overlaps it differently (minutes from 19:00).
    it.each([
      ['the identical slot', 0, 90],
      ['one that starts inside it', 60, 90],
      ['one that ends inside it', -60, 90],
      ['one fully inside it', 15, 30],
      ['one that fully contains it', -30, 180],
      ['one that overlaps by just 15 minutes', 75, 60],
    ])('rejects %s with 409 SLOT_TAKEN', async (_label, startMinutes, durationMinutes) => {
      // Arrange
      const { user, table } = await arrange();
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(0), endsAt: at(90) });

      // Act
      const res = await postBooking(user, bodyFor(table.id, { startsAt: at(startMinutes).toISOString(), durationMinutes }));

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'SLOT_TAKEN', message: 'This table is already booked for the requested time' },
      });
      expect(await prisma.booking.count()).toBe(1);
    });

    it('allows back-to-back bookings on both sides of an existing one', async () => {
      // Arrange: existing 19:00-20:30.
      const { user, table } = await arrange();
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(0), endsAt: at(90) });

      // Act
      const before = await postBooking(user, bodyFor(table.id, { startsAt: at(-90).toISOString() }));
      const after = await postBooking(user, bodyFor(table.id, { startsAt: at(90).toISOString() }));

      // Assert
      expect([before.status, after.status]).toEqual([201, 201]);
      expect(await prisma.booking.count({ where: { tableId: table.id } })).toBe(3);
    });

    it('frees the slot when the booking is cancelled, so it can be booked again', async () => {
      // Arrange
      const { user, table } = await arrange();
      const first = await postBooking(user, bodyFor(table.id));
      const firstId = bookingResponseSchema.parse(first.body).booking.id;
      const whileBooked = await postBooking(user, bodyFor(table.id));
      await prisma.booking.update({ where: { id: firstId }, data: { status: 'CANCELLED' } });

      // Act
      const afterCancel = await postBooking(user, bodyFor(table.id));

      // Assert
      expect(first.status).toBe(201);
      expect(whileBooked.status).toBe(409);
      expect(afterCancel.status).toBe(201);
      expect(await prisma.booking.count({ where: { tableId: table.id, status: 'CONFIRMED' } })).toBe(1);
    });
  });

  describe('table rules', () => {
    it('returns 404 NOT_FOUND for a table that does not exist', async () => {
      const user = await createUser();

      const res = await postBooking(user, bodyFor(randomUUID()));

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('returns 409 TABLE_INACTIVE for a deactivated table', async () => {
      const { user, table } = await arrange({ isActive: false });

      const res = await postBooking(user, bodyFor(table.id));

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'TABLE_INACTIVE' } });
      expect(await prisma.booking.count()).toBe(0);
    });

    it('returns 422 CAPACITY_EXCEEDED when the party is larger than the table', async () => {
      const { user, table } = await arrange({ capacity: 4 });

      const res = await postBooking(user, bodyFor(table.id, { partySize: 5 }));

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: { code: 'CAPACITY_EXCEEDED' } });
      expect(await prisma.booking.count()).toBe(0);
    });
  });

  describe('time rules', () => {
    it.each([
      ['a start in the past', () => utcDateAt(-1, 19), /in the future/],
      ['a start with too little notice', tooSoon, /at least 60 minutes/],
      ['a start too far ahead', () => utcDateAt(91, 19), /at most 90 days/],
    ])('returns 422 BOOKING_TIME_INVALID for %s and stores nothing', async (_label, makeStart, message) => {
      // Arrange
      const { user, table } = await arrange();

      // Act
      const res = await postBooking(user, bodyFor(table.id, { startsAt: makeStart().toISOString() }));

      // Assert
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: { code: 'BOOKING_TIME_INVALID' } });
      expect(JSON.stringify(res.body)).toMatch(message);
      expect(await prisma.booking.count()).toBe(0);
    });
  });

  describe('validation', () => {
    it.each([
      ['a missing tableId', { tableId: undefined }, 'tableId'],
      ['a tableId that is not a UUID', { tableId: 'T1' }, 'tableId'],
      ['a startsAt with no timezone', { startsAt: '2030-01-01T19:00:00' }, 'startsAt'],
      ['a startsAt off the 15-minute grid', { startsAt: '2030-01-01T19:10:00Z' }, 'startsAt'],
      ['a duration that is too short', { durationMinutes: 15 }, 'durationMinutes'],
      ['a duration that is too long', { durationMinutes: 300 }, 'durationMinutes'],
      ['a party of zero', { partySize: 0 }, 'partySize'],
      ['a party size sent as text', { partySize: '2' }, 'partySize'],
    ])('returns 400 VALIDATION_ERROR for %s', async (_label, overrides, field) => {
      // Arrange
      const { user, table } = await arrange();

      // Act
      const res = await postBooking(user, bodyFor(table.id, overrides));

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(JSON.stringify(res.body)).toContain(`${field}:`);
      expect(await prisma.booking.count()).toBe(0);
    });

    it('returns 400 INVALID_JSON for a malformed body', async () => {
      const { user } = await arrange();

      const res = await request(app)
        .post('/bookings')
        .set(...authHeaderFor(user))
        .set('Content-Type', 'application/json')
        .send('{"tableId":');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
    });
  });
});

// The next 15-minute boundary at least 10 minutes away: always inside the 60-minute notice window.
function tooSoon(): Date {
  const slotMs = 15 * MS_PER_MINUTE;
  return new Date(Math.ceil((Date.now() + 10 * MS_PER_MINUTE) / slotMs) * slotMs);
}

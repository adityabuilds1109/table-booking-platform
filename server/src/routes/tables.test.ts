import request from 'supertest';
import { z } from 'zod';
import app from '../app';
import { MS_PER_MINUTE } from '../bookings/rules';
import { createBooking, createTable, createUser } from '../test/factories';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { utcDateAt } from '../test/slots';

const availabilityResponseSchema = z.object({
  tables: z.array(z.object({ id: z.string(), name: z.string(), capacity: z.number() })),
});

// The slot every test asks about: 19:00-20:30 UTC, a week from today. Relative to "now" so it always passes the
// notice / max-advance rules, and fixed at 19:00 so the overlap arithmetic below is easy to read.
const DAYS_AHEAD = 7;
const REQUEST_START_HOUR = 19;
const REQUEST_MINUTES = 90;

const requestStart = utcDateAt(DAYS_AHEAD, REQUEST_START_HOUR);

// Minutes relative to the requested slot's start: at(-90) is 17:30, at(90) is 20:30 (the slot's end).
function at(minutesFromRequestStart: number): Date {
  return new Date(requestStart.getTime() + minutesFromRequestStart * MS_PER_MINUTE);
}

// Builds the query string parameters for a slot start.
function queryFor(start: Date, overrides: Record<string, string> = {}) {
  const iso = start.toISOString();
  return {
    date: iso.slice(0, 10),
    startTime: iso.slice(11, 16),
    durationMinutes: String(REQUEST_MINUTES),
    partySize: '2',
    ...overrides,
  };
}

async function getAvailability(overrides: Record<string, string> = {}, start: Date = requestStart) {
  return request(app).get('/tables/availability').query(queryFor(start, overrides));
}

async function availableNames(overrides: Record<string, string> = {}): Promise<string[]> {
  const res = await getAvailability(overrides);
  expect(res.status).toBe(200);
  return availabilityResponseSchema.parse(res.body).tables.map((table) => table.name);
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('GET /tables/availability', () => {
  it('is public: needs no Authorization header', async () => {
    await createTable({ name: 'T1' });

    const res = await getAvailability();

    expect(res.status).toBe(200);
  });

  it('returns only id, name and capacity, smallest tables first and ties by name', async () => {
    // Arrange
    await createTable({ name: 'B', capacity: 4 });
    await createTable({ name: 'A', capacity: 4 });
    await createTable({ name: 'C', capacity: 2 });

    // Act
    const res = await getAvailability();

    // Assert
    const { tables } = availabilityResponseSchema.parse(res.body);
    expect(tables.map((table) => table.name)).toEqual(['C', 'A', 'B']);
    expect(Object.keys(tables[0] ?? {}).sort()).toEqual(['capacity', 'id', 'name']);
  });

  it('returns an empty list, not an error, when nothing is available', async () => {
    const res = await getAvailability();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tables: [] });
  });

  describe('capacity filter', () => {
    beforeEach(async () => {
      await createTable({ name: 'for2', capacity: 2 });
      await createTable({ name: 'for4', capacity: 4 });
      await createTable({ name: 'for6', capacity: 6 });
    });

    it('excludes tables smaller than the party', async () => {
      expect(await availableNames({ partySize: '5' })).toEqual(['for6']);
    });

    it('includes a table whose capacity equals the party size exactly', async () => {
      expect(await availableNames({ partySize: '4' })).toEqual(['for4', 'for6']);
    });

    it('returns every table for a party of one', async () => {
      expect(await availableNames({ partySize: '1' })).toEqual(['for2', 'for4', 'for6']);
    });

    it('returns nothing when the party is larger than every table', async () => {
      expect(await availableNames({ partySize: '7' })).toEqual([]);
    });
  });

  it('excludes inactive tables', async () => {
    // Arrange
    await createTable({ name: 'open', capacity: 4 });
    await createTable({ name: 'closed', capacity: 4, isActive: false });

    // Act + Assert
    expect(await availableNames()).toEqual(['open']);
  });

  describe('bookings', () => {
    // Requested slot is at(0) to at(90). Each booking below overlaps it in a different way.
    it.each([
      ['the identical slot', 0, 90],
      ['one that ends inside the slot', -60, 30],
      ['one that starts inside the slot', 60, 150],
      ['one fully inside the slot', 15, 45],
      ['one that fully contains the slot', -60, 150],
    ])('a CONFIRMED booking for %s excludes that table only', async (_label, startMinutes, endMinutes) => {
      // Arrange
      const user = await createUser();
      const booked = await createTable({ name: 'booked', capacity: 4 });
      await createTable({ name: 'free', capacity: 4 });
      await createBooking({ userId: user.id, tableId: booked.id, startsAt: at(startMinutes), endsAt: at(endMinutes) });

      // Act + Assert
      expect(await availableNames()).toEqual(['free']);
    });

    it('a CANCELLED booking for the same slot does not exclude the table', async () => {
      // Arrange
      const user = await createUser();
      const table = await createTable({ name: 'T1' });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(0), endsAt: at(90), status: 'CANCELLED' });

      // Act + Assert
      expect(await availableNames()).toEqual(['T1']);
    });

    it('a CANCELLED booking does not hide a table that also has a CONFIRMED one elsewhere in the day', async () => {
      // Arrange
      const user = await createUser();
      const table = await createTable({ name: 'T1' });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(0), endsAt: at(90), status: 'CANCELLED' });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(-300), endsAt: at(-240) });

      // Act + Assert
      expect(await availableNames()).toEqual(['T1']);
    });

    it('back-to-back bookings on both sides leave the table available', async () => {
      // Arrange: one ends exactly when the slot starts, the other starts exactly when it ends.
      const user = await createUser();
      const table = await createTable({ name: 'T1' });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(-90), endsAt: at(0) });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(90), endsAt: at(180) });

      // Act + Assert
      expect(await availableNames()).toEqual(['T1']);
    });

    it('one minute of overlap is enough to exclude the table', async () => {
      // Arrange: ends one minute after the requested slot starts.
      const user = await createUser();
      const table = await createTable({ name: 'T1' });
      await createBooking({ userId: user.id, tableId: table.id, startsAt: at(-90), endsAt: at(1) });

      // Act + Assert
      expect(await availableNames()).toEqual([]);
    });

    it("a booking on another day doesn't affect the table", async () => {
      // Arrange
      const user = await createUser();
      const table = await createTable({ name: 'T1' });
      await createBooking({
        userId: user.id,
        tableId: table.id,
        startsAt: utcDateAt(DAYS_AHEAD + 1, REQUEST_START_HOUR),
        endsAt: utcDateAt(DAYS_AHEAD + 1, REQUEST_START_HOUR + 2),
      });

      // Act + Assert
      expect(await availableNames()).toEqual(['T1']);
    });
  });

  describe('time rules', () => {
    it('returns 422 BOOKING_TIME_INVALID for a start in the past', async () => {
      // Arrange
      await createTable();

      // Act
      const res = await getAvailability({}, utcDateAt(-1, REQUEST_START_HOUR));

      // Assert
      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        error: { code: 'BOOKING_TIME_INVALID', message: 'Booking start time must be in the future' },
      });
    });

    it('returns 422 for a start with too little notice', async () => {
      // Arrange: the next 15-minute boundary at least 10 minutes away, so it is always inside the 60-minute notice.
      const slotMs = 15 * MS_PER_MINUTE;
      const tooSoon = new Date(Math.ceil((Date.now() + 10 * MS_PER_MINUTE) / slotMs) * slotMs);

      // Act
      const res = await getAvailability({}, tooSoon);

      // Assert
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: { code: 'BOOKING_TIME_INVALID' } });
      expect(JSON.stringify(res.body)).toMatch(/at least 60 minutes/);
    });

    it('returns 422 for a start too far ahead', async () => {
      const res = await getAvailability({}, utcDateAt(91, REQUEST_START_HOUR));

      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toMatch(/at most 90 days/);
    });

    it('does not list any table when the time is rejected', async () => {
      await createTable({ name: 'T1' });

      const res = await getAvailability({}, utcDateAt(-1, REQUEST_START_HOUR));

      expect(res.body).not.toHaveProperty('tables');
    });
  });

  describe('validation', () => {
    it('returns 400 VALIDATION_ERROR for an impossible date', async () => {
      const res = await getAvailability({ date: '2026-02-30' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(JSON.stringify(res.body)).toMatch(/date:/);
    });

    it('returns 400 naming every missing parameter', async () => {
      const res = await request(app).get('/tables/availability');

      expect(res.status).toBe(400);
      for (const field of ['date', 'startTime', 'durationMinutes', 'partySize']) {
        expect(JSON.stringify(res.body)).toContain(`${field}:`);
      }
    });

    it.each([
      ['a start time off the grid', { startTime: '19:10' }],
      ['a duration that is not a multiple of 15', { durationMinutes: '100' }],
      ['a party of zero', { partySize: '0' }],
      ['a non-numeric party size', { partySize: 'four' }],
    ])('returns 400 for %s', async (_label, overrides) => {
      const res = await getAvailability(overrides);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });
});

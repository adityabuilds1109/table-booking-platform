import request from 'supertest';
import { z } from 'zod';
import app from '../app';
import { MS_PER_MINUTE } from '../bookings/rules';
import { MAX_PAGE_SIZE } from '../lib/pagination';
import { disconnectDatabase, resetDatabase } from '../test/db';
import { authHeaderFor, createBooking, createTable, createUser } from '../test/factories';
import { utcDateAt } from '../test/slots';

const listResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      tableId: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      partySize: z.number(),
      status: z.enum(['CONFIRMED', 'CANCELLED']),
      createdAt: z.string(),
      table: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

type User = Awaited<ReturnType<typeof createUser>>;
type Table = Awaited<ReturnType<typeof createTable>>;

// A booking on day `daysAhead` at 19:00-20:30 UTC. Different days never overlap, so one table can hold many.
function bookOnDay(user: User, table: Table, daysAhead: number, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') {
  const startsAt = utcDateAt(daysAhead, 19);
  return createBooking({
    userId: user.id,
    tableId: table.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * MS_PER_MINUTE),
    status,
  });
}

async function getMine(user: User, query: Record<string, string> = {}) {
  return request(app)
    .get('/bookings/me')
    .set(...authHeaderFor(user))
    .query(query);
}

async function parsedMine(user: User, query: Record<string, string> = {}) {
  const res = await getMine(user, query);
  expect(res.status).toBe(200);
  return listResponseSchema.parse(res.body);
}

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('GET /bookings/me', () => {
  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).get('/bookings/me');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).get('/bookings/me').set('Authorization', 'Bearer not.a.token');

      expect(res.status).toBe(401);
    });

    it('returns 401, not a validation error, for an anonymous caller with a bad query', async () => {
      const res = await request(app).get('/bookings/me').query({ page: '0' });

      expect(res.status).toBe(401);
    });
  });

  describe('which bookings are returned', () => {
    it("returns only the caller's bookings", async () => {
      // Arrange
      const me = await createUser();
      const other = await createUser();
      const table = await createTable({ name: 'T1' });
      const mine1 = await bookOnDay(me, table, 1);
      const mine2 = await bookOnDay(me, table, 2);
      const theirs = await bookOnDay(other, table, 3);

      // Act
      const mineResult = await parsedMine(me);
      const theirResult = await parsedMine(other);

      // Assert
      expect(mineResult.data.map((b) => b.id).sort()).toEqual([mine1.id, mine2.id].sort());
      expect(mineResult.total).toBe(2);
      expect(theirResult.data.map((b) => b.id)).toEqual([theirs.id]);
    });

    it('cannot be pointed at another user through the query string', async () => {
      // Arrange
      const me = await createUser();
      const other = await createUser();
      const table = await createTable();
      await bookOnDay(other, table, 1);

      // Act
      const result = await parsedMine(me, { userId: other.id });

      // Assert
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('includes cancelled bookings, so history stays visible', async () => {
      const me = await createUser();
      const table = await createTable();
      await bookOnDay(me, table, 1, 'CANCELLED');
      await bookOnDay(me, table, 2, 'CONFIRMED');

      const result = await parsedMine(me);

      expect(result.data.map((b) => b.status)).toEqual(['CONFIRMED', 'CANCELLED']);
    });

    it('includes the table id and name, and nothing about the user', async () => {
      // Arrange
      const me = await createUser();
      const table = await createTable({ name: 'Window 4', capacity: 6 });
      const booking = await bookOnDay(me, table, 1);

      // Act
      const result = await parsedMine(me);

      // Assert
      const [first] = result.data;
      expect(first).toMatchObject({ id: booking.id, tableId: table.id, partySize: 2, table: { id: table.id, name: 'Window 4' } });
      expect(Object.keys(first ?? {}).sort()).toEqual(
        ['createdAt', 'endsAt', 'id', 'partySize', 'startsAt', 'status', 'table', 'tableId'],
      );
      expect(Object.keys(first?.table ?? {}).sort()).toEqual(['id', 'name']);
    });

    it('returns an empty list, not an error, when the caller has no bookings', async () => {
      const me = await createUser();

      const res = await getMine(me);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });
  });

  describe('ordering', () => {
    it('orders by start time, latest first, whatever order they were created in', async () => {
      // Arrange: created out of order on purpose.
      const me = await createUser();
      const table = await createTable();
      const day3 = await bookOnDay(me, table, 3);
      const day1 = await bookOnDay(me, table, 1);
      const day5 = await bookOnDay(me, table, 5);
      const day2 = await bookOnDay(me, table, 2);

      // Act
      const result = await parsedMine(me);

      // Assert
      expect(result.data.map((b) => b.id)).toEqual([day5.id, day3.id, day2.id, day1.id]);
    });

    it('keeps pages consistent when bookings share a start time: no repeats, no gaps', async () => {
      // Arrange: five bookings at the identical instant (five tables), so only the tie-breaker orders them.
      const me = await createUser();
      const created = [];
      for (let i = 0; i < 5; i += 1) {
        created.push(await bookOnDay(me, await createTable({ name: `T${i}` }), 1));
      }

      // Act
      const pages = [
        await parsedMine(me, { pageSize: '2', page: '1' }),
        await parsedMine(me, { pageSize: '2', page: '2' }),
        await parsedMine(me, { pageSize: '2', page: '3' }),
      ];

      // Assert: nothing repeated or skipped across the pages...
      const seen = pages.flatMap((p) => p.data.map((b) => b.id));
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
      expect([...seen].sort()).toEqual(created.map((b) => b.id).sort());
      // ...because ties are broken by id, ascending. Ids are random UUIDs, so insertion order differs from id order
      // (all but 1 time in 120), which is what lets this fail if the tie-breaker is ever removed.
      expect(seen).toEqual(created.map((b) => b.id).sort());
    });
  });

  describe('pagination', () => {
    // Five bookings on days 1..5, so the latest-first order is day5, day4, day3, day2, day1.
    async function arrangeFive() {
      const me = await createUser();
      const table = await createTable();
      const byDay: Awaited<ReturnType<typeof bookOnDay>>[] = [];
      for (let day = 1; day <= 5; day += 1) {
        byDay.push(await bookOnDay(me, table, day));
      }
      return { me, ids: byDay.map((b) => b.id).reverse() };
    }

    it('defaults to page 1 with 20 per page', async () => {
      const { me } = await arrangeFive();

      const result = await parsedMine(me);

      expect(result).toMatchObject({ page: 1, pageSize: 20, total: 5, totalPages: 1 });
      expect(result.data).toHaveLength(5);
    });

    it('returns the second page with the right slice and metadata', async () => {
      const { me, ids } = await arrangeFive();

      const result = await parsedMine(me, { page: '2', pageSize: '2' });

      expect(result.data.map((b) => b.id)).toEqual([ids[2], ids[3]]);
      expect(result).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    });

    it('returns a short last page', async () => {
      const { me, ids } = await arrangeFive();

      const result = await parsedMine(me, { page: '3', pageSize: '2' });

      expect(result.data.map((b) => b.id)).toEqual([ids[4]]);
    });

    it('returns an empty page, not an error, past the last page', async () => {
      const { me } = await arrangeFive();

      const res = await getMine(me, { page: '4', pageSize: '2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], page: 4, pageSize: 2, total: 5, totalPages: 3 });
    });

    it('has exactly one page when the total equals the page size', async () => {
      const { me } = await arrangeFive();

      const result = await parsedMine(me, { pageSize: '5' });

      expect(result).toMatchObject({ total: 5, totalPages: 1 });
      expect(result.data).toHaveLength(5);
    });

    it('splits 25 bookings into 20 + 5 with the default page size', async () => {
      // Arrange
      const me = await createUser();
      const table = await createTable();
      for (let day = 1; day <= 25; day += 1) {
        await bookOnDay(me, table, day);
      }

      // Act
      const first = await parsedMine(me);
      const second = await parsedMine(me, { page: '2' });

      // Assert
      expect(first.data).toHaveLength(20);
      expect(second.data).toHaveLength(5);
      expect(first).toMatchObject({ total: 25, totalPages: 2 });
    });

    it(`accepts the maximum page size of ${MAX_PAGE_SIZE}`, async () => {
      const { me } = await arrangeFive();

      const result = await parsedMine(me, { pageSize: String(MAX_PAGE_SIZE) });

      expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it.each([
      ['a page size above the cap', { pageSize: String(MAX_PAGE_SIZE + 1) }, 'pageSize'],
      ['a page size of zero', { pageSize: '0' }, 'pageSize'],
      ['a negative page size', { pageSize: '-5' }, 'pageSize'],
      ['page zero', { page: '0' }, 'page'],
      ['a non-numeric page', { page: 'abc' }, 'page'],
      ['a fractional page', { page: '1.5' }, 'page'],
      ['an absurdly large page', { page: '100001' }, 'page'],
    ])('returns 400 VALIDATION_ERROR for %s', async (_label, query, field) => {
      const me = await createUser();

      const res = await getMine(me, query);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(JSON.stringify(res.body)).toContain(`${field}:`);
    });
  });
});

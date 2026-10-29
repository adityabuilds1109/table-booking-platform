import { availabilityQuerySchema, createBookingSchema } from './schemas';

const TABLE_ID = '6f1c3a4e-8d2b-4c55-9a1e-0b7f6a2d9c11';

const validQuery = { date: '2026-11-03', startTime: '19:00', durationMinutes: '90', partySize: '4' };
const validBody = { tableId: TABLE_ID, startsAt: '2026-11-03T19:00:00Z', durationMinutes: 90, partySize: 4 };

// Returns the paths of the fields that failed, e.g. ["date"], so tests can say WHICH field was rejected.
function failedFields(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('availabilityQuerySchema', () => {
  it('parses a valid query into a UTC instant plus numbers', () => {
    const result = availabilityQuerySchema.parse(validQuery);

    expect(result.startsAt.toISOString()).toBe('2026-11-03T19:00:00.000Z');
    expect(result.durationMinutes).toBe(90);
    expect(result.partySize).toBe(4);
  });

  describe('date', () => {
    it.each([
      ['a leap day', '2028-02-29'],
      ['the last day of a year', '2026-12-31'],
    ])('accepts %s', (_label, date) => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, date }).success).toBe(true);
    });

    // The check requested for this step: z.iso.date() validates the calendar, not just the shape.
    it.each([
      ['February 30th', '2026-02-30'],
      ['February 29th in a non-leap year', '2026-02-29'],
      ['April 31st', '2026-04-31'],
      ['month 13', '2026-13-01'],
      ['day 00', '2026-11-00'],
    ])('rejects an impossible date: %s', (_label, date) => {
      const result = availabilityQuerySchema.safeParse({ ...validQuery, date });

      expect(result.success).toBe(false);
      expect(failedFields(result)).toEqual(['date']);
    });

    it.each(['2026-1-3', '03/11/2026', '2026-11-03T19:00', '', 'tomorrow'])('rejects the malformed value %j', (date) => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, date }).success).toBe(false);
    });

    it('rejects a missing date', () => {
      const { date: _omitted, ...withoutDate } = validQuery;

      expect(failedFields(availabilityQuerySchema.safeParse(withoutDate))).toEqual(['date']);
    });
  });

  describe('startTime', () => {
    it.each(['00:00', '19:00', '19:15', '19:30', '19:45', '23:45'])('accepts %s', (startTime) => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, startTime }).success).toBe(true);
    });

    it.each([
      ['off the 15-minute grid', '19:10'],
      ['hour 24', '24:00'],
      ['minute 60', '19:60'],
      ['no leading zero', '9:00'],
      ['with seconds', '19:00:00'],
      ['12-hour clock', '7:00pm'],
      ['empty', ''],
    ])('rejects a time %s', (_label, startTime) => {
      const result = availabilityQuerySchema.safeParse({ ...validQuery, startTime });

      expect(result.success).toBe(false);
      expect(failedFields(result)).toEqual(['startTime']);
    });
  });

  describe('durationMinutes and partySize (query strings are text)', () => {
    it.each(['30', '45', '90', '240'])('accepts durationMinutes "%s"', (durationMinutes) => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, durationMinutes }).success).toBe(true);
    });

    it.each(['15', '29', '241', '100', '90.5', '0', '-30', '', 'abc'])('rejects durationMinutes %j', (durationMinutes) => {
      expect(failedFields(availabilityQuerySchema.safeParse({ ...validQuery, durationMinutes }))).toEqual([
        'durationMinutes',
      ]);
    });

    it.each(['1', '4', '20'])('accepts partySize "%s"', (partySize) => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, partySize }).success).toBe(true);
    });

    it.each(['0', '21', '-1', '2.5', '', 'four'])('rejects partySize %j', (partySize) => {
      expect(failedFields(availabilityQuerySchema.safeParse({ ...validQuery, partySize }))).toEqual(['partySize']);
    });

    it('rejects a repeated parameter (?partySize=2&partySize=3)', () => {
      expect(availabilityQuerySchema.safeParse({ ...validQuery, partySize: ['2', '3'] }).success).toBe(false);
    });
  });

  it('reports every bad field at once', () => {
    const result = availabilityQuerySchema.safeParse({
      date: '2026-02-30',
      startTime: '19:10',
      durationMinutes: '5',
      partySize: '0',
    });

    expect(failedFields(result).sort()).toEqual(['date', 'durationMinutes', 'partySize', 'startTime']);
  });
});

describe('createBookingSchema', () => {
  it('parses a valid body and turns startsAt into a Date', () => {
    const result = createBookingSchema.parse(validBody);

    expect(result.startsAt).toBeInstanceOf(Date);
    expect(result.startsAt.toISOString()).toBe('2026-11-03T19:00:00.000Z');
    expect(result).toMatchObject({ tableId: TABLE_ID, durationMinutes: 90, partySize: 4 });
  });

  describe('startsAt', () => {
    it('converts an explicit offset to the same instant in UTC', () => {
      const result = createBookingSchema.parse({ ...validBody, startsAt: '2026-11-03T21:00:00+02:00' });

      expect(result.startsAt.toISOString()).toBe('2026-11-03T19:00:00.000Z');
    });

    it('accepts an offset with a half-hour component', () => {
      const result = createBookingSchema.parse({ ...validBody, startsAt: '2026-11-04T00:30:00+05:30' });

      expect(result.startsAt.toISOString()).toBe('2026-11-03T19:00:00.000Z');
    });

    it('accepts explicit zero milliseconds', () => {
      expect(createBookingSchema.safeParse({ ...validBody, startsAt: '2026-11-03T19:00:00.000Z' }).success).toBe(true);
    });

    it.each([
      ['no zone at all', '2026-11-03T19:00:00'],
      ['a space instead of T', '2026-11-03 19:00:00Z'],
      ['no seconds', '2026-11-03T19:00Z'],
      ['an impossible date', '2026-02-30T19:00:00Z'],
      ['hour 25', '2026-11-03T25:00:00Z'],
      ['an offset without a colon', '2026-11-03T19:00:00+0200'],
      ['a date only', '2026-11-03'],
      ['an epoch number as text', '1793732400'],
      ['empty', ''],
    ])('rejects %s', (_label, startsAt) => {
      const result = createBookingSchema.safeParse({ ...validBody, startsAt });

      expect(result.success).toBe(false);
      expect(failedFields(result)).toEqual(['startsAt']);
    });

    it.each([
      ['7 minutes past', '2026-11-03T19:07:00Z'],
      ['with stray seconds', '2026-11-03T19:00:30Z'],
      ['with stray milliseconds', '2026-11-03T19:00:00.500Z'],
    ])('rejects a time off the 15-minute grid: %s', (_label, startsAt) => {
      expect(failedFields(createBookingSchema.safeParse({ ...validBody, startsAt }))).toEqual(['startsAt']);
    });

    it('rejects a number instead of a string', () => {
      expect(createBookingSchema.safeParse({ ...validBody, startsAt: 1793732400000 }).success).toBe(false);
    });
  });

  describe('durationMinutes and partySize (JSON numbers)', () => {
    it.each([30, 45, 240])('accepts durationMinutes %d', (durationMinutes) => {
      expect(createBookingSchema.safeParse({ ...validBody, durationMinutes }).success).toBe(true);
    });

    it.each([0, 15, 29, 241, 100, 90.5, -30])('rejects durationMinutes %d', (durationMinutes) => {
      expect(failedFields(createBookingSchema.safeParse({ ...validBody, durationMinutes }))).toEqual(['durationMinutes']);
    });

    it.each(['90', null, true])('rejects durationMinutes of the wrong type %j', (durationMinutes) => {
      expect(createBookingSchema.safeParse({ ...validBody, durationMinutes }).success).toBe(false);
    });

    it.each([1, 20])('accepts partySize %d', (partySize) => {
      expect(createBookingSchema.safeParse({ ...validBody, partySize }).success).toBe(true);
    });

    it.each([0, 21, -1, 2.5])('rejects partySize %d', (partySize) => {
      expect(failedFields(createBookingSchema.safeParse({ ...validBody, partySize }))).toEqual(['partySize']);
    });

    it('rejects a partySize sent as text', () => {
      expect(createBookingSchema.safeParse({ ...validBody, partySize: '4' }).success).toBe(false);
    });
  });

  describe('tableId', () => {
    it.each(['not-a-uuid', '', '123', '6f1c3a4e-8d2b-4c55-9a1e'])('rejects %j', (tableId) => {
      expect(failedFields(createBookingSchema.safeParse({ ...validBody, tableId }))).toEqual(['tableId']);
    });

    it('rejects a missing tableId', () => {
      const { tableId: _omitted, ...withoutTable } = validBody;

      expect(failedFields(createBookingSchema.safeParse(withoutTable))).toEqual(['tableId']);
    });
  });

  it('drops fields the client should not control, such as userId or endsAt', () => {
    const result = createBookingSchema.parse({
      ...validBody,
      userId: 'someone-else',
      endsAt: '2026-11-03T23:00:00Z',
      status: 'CANCELLED',
    });

    expect(Object.keys(result).sort()).toEqual(['durationMinutes', 'partySize', 'startsAt', 'tableId']);
  });
});

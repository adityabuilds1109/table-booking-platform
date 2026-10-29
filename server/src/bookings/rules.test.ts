import { AppError } from '../errors';
import { assertBookable, BOOKING_RULES, endsAtFor, MS_PER_MINUTE } from './rules';

const NOW = new Date('2026-11-03T12:00:00.000Z');

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MS_PER_MINUTE);
}

function thrownBy(fn: () => void): unknown {
  try {
    fn();
  } catch (err: unknown) {
    return err;
  }
  return undefined;
}

describe('assertBookable', () => {
  const minNotice = BOOKING_RULES.minNoticeMinutes;
  const maxAdvance = BOOKING_RULES.maxAdvanceDays * 24 * 60;

  it.each([
    ['exactly the minimum notice', minNotice],
    ['just over the minimum notice', minNotice + 1],
    ['a typical evening booking', 7 * 60],
    ['exactly the maximum advance', maxAdvance],
  ])('accepts a start %s', (_label, minutesAhead) => {
    expect(() => assertBookable(minutesFromNow(minutesAhead), NOW)).not.toThrow();
  });

  it.each([
    ['a day in the past', -24 * 60],
    ['a minute in the past', -1],
    ['exactly now', 0],
  ])('rejects a start %s as being in the past', (_label, minutesAhead) => {
    expect(() => assertBookable(minutesFromNow(minutesAhead), NOW)).toThrow('must be in the future');
  });

  it.each([
    ['one minute from now', 1],
    ['just under the minimum notice', minNotice - 1],
  ])('rejects a start %s for too little notice', (_label, minutesAhead) => {
    expect(() => assertBookable(minutesFromNow(minutesAhead), NOW)).toThrow(`at least ${minNotice} minutes`);
  });

  it('rejects a start just beyond the maximum advance', () => {
    expect(() => assertBookable(minutesFromNow(maxAdvance + 1), NOW)).toThrow(
      `at most ${BOOKING_RULES.maxAdvanceDays} days`,
    );
  });

  it('throws a 422 AppError with code BOOKING_TIME_INVALID', () => {
    const err = thrownBy(() => assertBookable(minutesFromNow(-5), NOW));

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 422, code: 'BOOKING_TIME_INVALID' });
  });

  it('uses the clock it is given, not the real one', () => {
    const farFuture = new Date('2040-01-01T12:00:00.000Z');

    expect(() => assertBookable(new Date('2040-01-01T20:00:00.000Z'), farFuture)).not.toThrow();
  });
});

describe('endsAtFor', () => {
  it('adds the duration in minutes', () => {
    const startsAt = new Date('2026-11-03T19:00:00.000Z');

    expect(endsAtFor(startsAt, 90).toISOString()).toBe('2026-11-03T20:30:00.000Z');
  });

  it('crosses midnight', () => {
    const startsAt = new Date('2026-11-03T23:30:00.000Z');

    expect(endsAtFor(startsAt, 60).toISOString()).toBe('2026-11-04T00:30:00.000Z');
  });

  it('does not change the start date it was given', () => {
    const startsAt = new Date('2026-11-03T19:00:00.000Z');

    endsAtFor(startsAt, 120);

    expect(startsAt.toISOString()).toBe('2026-11-03T19:00:00.000Z');
  });
});

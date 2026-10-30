// Checks the booking page's "pure core": the local-time -> UTC conversion, the search validation, the URL parameters and the
// error messages, against the SERVER'S own rules.
//
//   cd client && npm run check:time-conversion
//
// Run it by hand after changing anything in client/src/booking/ or the server's booking rules. It is deliberately NOT part
// of CI and adds no dependency: it runs through the `tsx` that the server already has installed (so `npm ci` must have been
// run in server/ too). It takes a few seconds.
//
// How the time conversion is proven: for each of ~16 time zones (half-hour and 45-minute offsets, daylight saving in both
// hemispheres, the +14 zone, Samoa's missing day) and for EVERY 15-minute slot of every day of a year, the function under test
// (which uses `new Date(y, m, d, h, min)` in the device's zone) is compared with an independent oracle built from `Intl`
// (which finds the UTC instants whose wall-clock reading in that zone matches). Every converted slot must also be accepted
// by the server's own `availabilityQuerySchema` and describe the same instant.

import { ApiError } from '../src/api/client';
import { describeBookingError, describeCancelError, describeListError, describeSearchError } from '../src/booking/bookingErrors';
import { BOOKING_LIMITS, DURATION_VALUES, MAX_PAGE_NUMBER, MY_BOOKINGS_PAGE_SIZE, PARTY_SIZE_VALUES, START_TIME_VALUES, formatDuration } from '../src/booking/bookingLimits';
import { describeBookingStatus, describeListPage, pageSearch, readPageParam } from '../src/booking/myBookings';
import { defaultSearchValues, readSearchParams, toSearchParams } from '../src/booking/searchParams';
import { validateSearch } from '../src/booking/searchValidation';
import {
  addLocalDays,
  describeDeviceTimeZone,
  formatStartTimeLabel,
  formatTimeRange,
  localDateString,
  localSlotToUtc,
} from '../src/booking/timeConversion';
import { BOOKING_RULES } from '../../server/src/bookings/rules';
import { availabilityQuerySchema } from '../../server/src/bookings/schemas';
import { paginationQuerySchema } from '../../server/src/lib/pagination';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n         -> ${detail}` : ''}`);
  }
}
const section = (title: string) => console.log(`\n== ${title}`);
const setZone = (zone: string) => {
  process.env.TZ = zone;
};

// ---------- 0. can this Node switch time zones while running? (everything below depends on it) ----------
section('0. the check itself works');
setZone('Asia/Kolkata');
const kolkata = new Date(2026, 0, 1, 12, 0).toISOString();
setZone('America/New_York');
const newYork = new Date(2026, 0, 1, 12, 0).toISOString();
if (kolkata !== '2026-01-01T06:30:00.000Z' || newYork !== '2026-01-01T17:00:00.000Z') {
  console.log(`  This Node cannot switch time zones at runtime (got ${kolkata} / ${newYork}); the check cannot run here.`);
  process.exit(2);
}
console.log('  ok   runtime time-zone switching works (Kolkata noon = 06:30Z, New York noon = 17:00Z)');

// ---------- 1. the client's limits are the server's limits ----------
section('1. limits and option lists match the server');
for (const key of Object.keys(BOOKING_RULES) as (keyof typeof BOOKING_RULES)[]) {
  check(`BOOKING_LIMITS.${key} = ${BOOKING_RULES[key]}`, BOOKING_LIMITS[key as keyof typeof BOOKING_LIMITS] === BOOKING_RULES[key], `client ${String(BOOKING_LIMITS[key as keyof typeof BOOKING_LIMITS])}`);
}
check('same set of limits on both sides', Object.keys(BOOKING_LIMITS).sort().join() === Object.keys(BOOKING_RULES).sort().join());

const serverAccepts = (overrides: Partial<Record<'date' | 'startTime' | 'durationMinutes' | 'partySize', string>>) =>
  availabilityQuerySchema.safeParse({ date: '2026-11-03', startTime: '19:00', durationMinutes: '90', partySize: '2', ...overrides }).success;
const allMinutes = Array.from({ length: 24 * 60 }, (_, m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
check('start-time list = exactly the HH:mm values the server accepts (1440 candidates)', allMinutes.every((t) => serverAccepts({ startTime: t }) === START_TIME_VALUES.includes(t)) && START_TIME_VALUES.length === 96);
check('duration list = exactly the durations the server accepts (0..300)', Array.from({ length: 301 }, (_, d) => d).every((d) => serverAccepts({ durationMinutes: String(d) }) === DURATION_VALUES.includes(String(d))) && DURATION_VALUES.length === 15);
check('party-size list = exactly the sizes the server accepts (0..25)', Array.from({ length: 26 }, (_, p) => p).every((p) => serverAccepts({ partySize: String(p) }) === PARTY_SIZE_VALUES.includes(String(p))) && PARTY_SIZE_VALUES.length === 20);
check('duration labels: 30 min, 1 h, 1 h 15 min, 1 h 30 min, 4 h', [30, 60, 75, 90, 240].map(formatDuration).join('|') === '30 min|1 h|1 h 15 min|1 h 30 min|4 h');

// ---------- 2. the conversion, against an independent oracle, in many zones ----------
section('2. local time -> UTC, every 15-minute slot of every day, in many time zones');

// The oracle: which UTC instants show the wall-clock reading "date time" in `zone`? Uses only Intl with an explicit zone,
// never `new Date(y, m, d, ...)`. Zero instants = the time doesn't exist; two = it happens twice.
const formatters = new Map<string, Intl.DateTimeFormat>();
function reading(zone: string, ms: number): string {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    formatters.set(zone, formatter);
  }
  return formatter.format(ms).replace(/\D/g, ''); // "202611031900"
}
const offsetCache = new Map<string, number>();
function offsetMinutes(zone: string, ms: number): number {
  const bucket = Math.floor(ms / 900_000);
  const key = `${zone}|${bucket}`;
  const cached = offsetCache.get(key);
  if (cached !== undefined) return cached;
  const r = reading(zone, bucket * 900_000);
  const asUtc = Date.UTC(+r.slice(0, 4), +r.slice(4, 6) - 1, +r.slice(6, 8), +r.slice(8, 10), +r.slice(10, 12));
  const result = (asUtc - bucket * 900_000) / 60_000;
  offsetCache.set(key, result);
  return result;
}
function oracle(zone: string, date: string, time: string): number[] {
  const wanted = `${date}${time}`.replace(/\D/g, '');
  const wallAsUtc = Date.parse(`${date}T${time}:00.000Z`);
  const offsets = new Set([-86_400_000, 0, 86_400_000].map((shift) => offsetMinutes(zone, wallAsUtc + shift)));
  return [...new Set([...offsets].map((offset) => wallAsUtc - offset * 60_000).filter((ms) => reading(zone, ms) === wanted))].sort((a, b) => a - b);
}

type ZoneStats = { slots: number; nonexistent: number; ambiguous: number; utcDateDiffers: number; failures: string[] };
function sweep(zone: string, firstDate: string, days: number): ZoneStats {
  setZone(zone);
  const stats: ZoneStats = { slots: 0, nonexistent: 0, ambiguous: 0, utcDateDiffers: 0, failures: [] };
  const fail = (date: string, time: string, why: string) => stats.failures.push(`${zone} ${date} ${time}: ${why}`);
  const [y, m, d] = firstDate.split('-').map(Number);
  for (let day = 0; day < days; day += 1) {
    const date = new Date(Date.UTC(y, m - 1, d + day)).toISOString().slice(0, 10);
    for (const time of START_TIME_VALUES) {
      stats.slots += 1;
      const expected = oracle(zone, date, time);
      const actual = localSlotToUtc({ date, time });

      if (expected.length === 0) {
        stats.nonexistent += 1;
        if (actual.ok || actual.reason !== 'nonexistent') fail(date, time, `time does not exist, but got ${JSON.stringify(actual.ok ? actual.startsAt : actual)}`);
        continue;
      }
      if (!actual.ok) { fail(date, time, `time exists but conversion said ${actual.reason}`); continue; }
      const instant = actual.instant.getTime();
      if (expected.length === 1) {
        if (instant !== expected[0]) fail(date, time, `wrong instant ${actual.startsAt}, expected ${new Date(expected[0]).toISOString()}`);
        if (actual.ambiguous) fail(date, time, 'flagged ambiguous but happens once');
      } else if (expected.length === 2) {
        stats.ambiguous += 1;
        if (!actual.ambiguous) fail(date, time, 'happens twice but not flagged ambiguous');
        if (instant !== expected[0]) fail(date, time, `ambiguous time resolved to the LATER instant ${actual.startsAt}`);
      } else {
        fail(date, time, `oracle found ${expected.length} instants`);
      }

      // The converted pieces are exactly what the API wants.
      if (actual.startsAt.slice(0, 10) !== actual.utcDate || actual.startsAt.slice(11, 16) !== actual.utcTime) fail(date, time, 'utcDate/utcTime disagree with startsAt');
      if (actual.utcDate !== date) stats.utcDateDiffers += 1;
      const server = availabilityQuerySchema.safeParse({ date: actual.utcDate, startTime: actual.utcTime, durationMinutes: '90', partySize: '2' });
      if (!server.success) fail(date, time, `SERVER REJECTED the converted slot ${actual.utcDate} ${actual.utcTime}`);
      else if (server.data.startsAt.getTime() !== instant) fail(date, time, 'server reads a different instant than the client built');
    }
  }
  return stats;
}

const ZONES = [
  'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Tokyo',
  'Pacific/Chatham', 'Australia/Lord_Howe', 'Australia/Adelaide', 'America/St_Johns', 'America/Sao_Paulo', 'Pacific/Honolulu', 'Pacific/Kiritimati',
];
const totals = { nonexistent: 0, ambiguous: 0, dateShift: 0, slots: 0 };
const allFailures: string[] = [];
for (const zone of ZONES) {
  const s = sweep(zone, '2026-11-01', 366);
  totals.nonexistent += s.nonexistent; totals.ambiguous += s.ambiguous; totals.dateShift += s.utcDateDiffers; totals.slots += s.slots;
  allFailures.push(...s.failures);
  console.log(`  ${s.failures.length === 0 ? 'ok  ' : 'FAIL'} ${zone.padEnd(21)} ${String(s.slots).padStart(6)} slots   ${String(s.nonexistent).padStart(3)} nonexistent   ${String(s.ambiguous).padStart(3)} ambiguous   ${String(s.utcDateDiffers).padStart(5)} where the UTC date differs from the local date`);
}
// Historic oddities: Samoa skipped the whole of 30 Dec 2011; Brazil's clocks jumped at midnight (00:00-01:00 did not exist on 2018-11-04).
const apia = sweep('Pacific/Apia', '2011-12-28', 5);
const brazil = sweep('America/Sao_Paulo', '2018-11-02', 4);
for (const [label, s, expectNonexistent] of [['Pacific/Apia 2011 (a whole day never happened)', apia, 96], ['America/Sao_Paulo 2018 (midnight hour skipped)', brazil, 4]] as const) {
  allFailures.push(...s.failures);
  check(`${label}: ${expectNonexistent} nonexistent slots found and reported`, s.failures.length === 0 && s.nonexistent === expectNonexistent, `${s.nonexistent} found`);
}
check(`every slot of ${totals.slots.toLocaleString('en-US')} converted correctly (independent oracle + accepted by the server's own schema)`, allFailures.length === 0, allFailures.slice(0, 8).join('\n         '));
check('the sweep really exercised the hard cases (nonexistent, ambiguous and UTC-date-shifted slots all occurred)', totals.nonexistent > 0 && totals.ambiguous > 0 && totals.dateShift > 1000, JSON.stringify(totals));

setZone('America/New_York');
const springForward = localSlotToUtc({ date: '2027-03-14', time: '02:30' });
check('spring forward: New York 2027-03-14 02:30 is reported as nonexistent (JavaScript alone would silently give 03:30)', !springForward.ok && springForward.reason === 'nonexistent');
const fallBack = localSlotToUtc({ date: '2026-11-01', time: '01:30' });
check('fall back: New York 2026-11-01 01:30 is flagged ambiguous and resolved to the first one (EDT = 05:30Z)', fallBack.ok && fallBack.ambiguous && fallBack.startsAt === '2026-11-01T05:30:00.000Z');
check('not-real dates and malformed input are "invalid"', ['2026-02-30', '2026-13-01', '0099-01-01', '', 'tomorrow', '2026-1-3'].every((date) => { const r = localSlotToUtc({ date, time: '19:00' }); return !r.ok && r.reason === 'invalid'; }) && ['', '7pm', '24:00', '19:60', '19:7'].every((time) => { const r = localSlotToUtc({ date: '2026-11-03', time }); return !r.ok && r.reason === 'invalid'; }));

// ---------- 3. showing times back ----------
section('3. times shown back to the person');
const berlin = { locale: 'en-GB', timeZone: 'Europe/Berlin' };
const rangeBerlin = formatTimeRange('2026-11-03T18:00:00.000Z', '2026-11-03T19:30:00.000Z', berlin);
check('Berlin: 19:00-20:30 with the zone and the day', /19:00.20:30 CET/.test(rangeBerlin) && /Tue/.test(rangeBerlin) && /3 Nov/.test(rangeBerlin), rangeBerlin);
const rangeKolkata = formatTimeRange('2026-11-03T18:00:00.000Z', '2026-11-03T19:30:00.000Z', { locale: 'en-GB', timeZone: 'Asia/Kolkata' });
check('Kolkata: a booking running past local midnight shows both days', /3 Nov/.test(rangeKolkata) && /4 Nov/.test(rangeKolkata) && /23:30/.test(rangeKolkata) && /01:00/.test(rangeKolkata), rangeKolkata);
const rangeAcrossChange = formatTimeRange('2026-11-01T05:30:00.000Z', '2026-11-01T07:00:00.000Z', { locale: 'en-US', timeZone: 'America/New_York' });
check('a booking that spans a clock change shows BOTH zone names (EDT and EST)', /EDT/.test(rangeAcrossChange) && /EST/.test(rangeAcrossChange), rangeAcrossChange);
check('start-time labels follow the locale: 7:00 PM in en-US, 19:00 in en-GB', /^7:00\sPM$/.test(formatStartTimeLabel('19:00', 'en-US')) && formatStartTimeLabel('19:00', 'en-GB') === '19:00');
check('start-time labels never shift with the device zone', ['Pacific/Kiritimati', 'Pacific/Honolulu', 'America/New_York'].every((z) => { setZone(z); return formatStartTimeLabel('02:30', 'en-GB') === '02:30'; }));
check('"Europe/Berlin (CET)" names the zone for the sentence under the fields', describeDeviceTimeZone(new Date('2026-11-03T18:00:00Z'), berlin) === 'Europe/Berlin (CET)' && describeDeviceTimeZone(new Date('2026-07-03T18:00:00Z'), berlin) === 'Europe/Berlin (CEST)');
setZone('America/New_York');
check('local date strings and "add days" follow the calendar, not 24-hour blocks (clock-change days are 23 or 25 hours)', localDateString(addLocalDays(new Date(2026, 10, 1, 12), 1)) === '2026-11-02' && localDateString(addLocalDays(new Date(2027, 2, 13, 12), 1)) === '2027-03-14' && localDateString(addLocalDays(new Date(2027, 2, 14, 12), -1)) === '2027-03-13');

// ---------- 4. search validation, with a fixed clock ----------
section('4. search validation (fixed clock)');
const base = { date: '2026-11-03', time: '19:00', duration: '90', party: '2' };
const NOW = new Date('2026-10-30T12:00:00.000Z');
const expectQuery = (zone: string, values: Partial<typeof base>, expected: { date: string; startTime: string }) => {
  setZone(zone);
  const r = validateSearch({ ...base, ...values }, NOW);
  return r.ok && r.search.query.date === expected.date && r.search.query.startTime === expected.startTime && r.search.query.durationMinutes === 90 && r.search.query.partySize === 2;
};
check('UTC: nothing changes', expectQuery('UTC', {}, { date: '2026-11-03', startTime: '19:00' }));
check('Kolkata 19:00 (+05:30) is 13:30 UTC, same day', expectQuery('Asia/Kolkata', {}, { date: '2026-11-03', startTime: '13:30' }));
check('New York 19:00 (EST, -05:00) is 00:00 UTC on the NEXT day', expectQuery('America/New_York', {}, { date: '2026-11-04', startTime: '00:00' }));
check('Kiritimati 01:00 (+14:00) on 3 Nov is 11:00 UTC on 2 Nov: the UTC date comes from the instant, not from the date box', expectQuery('Pacific/Kiritimati', { time: '01:00' }, { date: '2026-11-02', startTime: '11:00' }));
check('Kathmandu 19:00 (+05:45) is 13:15 UTC (the 45-minute offset stays on the 15-minute grid)', expectQuery('Asia/Kathmandu', {}, { date: '2026-11-03', startTime: '13:15' }));
check('the fall-back time is accepted and marked ambiguous', (() => { setZone('America/New_York'); const r = validateSearch({ ...base, date: '2026-11-01', time: '01:30' }, NOW); return r.ok && r.search.slot.ambiguous && r.search.query.startTime === '05:30'; })());

const err = (zone: string, values: Partial<typeof base>, now = NOW) => { setZone(zone); const r = validateSearch({ ...base, ...values }, now); return r.ok ? null : r.errors; };
setZone('Europe/Berlin'); // NOW is 13:00 in Berlin (CET)
check('notice rule, inclusive: exactly 60 minutes ahead (14:00) is accepted', err('Europe/Berlin', { date: '2026-10-30', time: '14:00' }) === null);
check('notice rule: 59 minutes ahead (13:45) is refused with the notice message', /at least 60 minutes/.test(err('Europe/Berlin', { date: '2026-10-30', time: '13:45' })?.time ?? ''));
check('a time that is right now, or already passed today, says it has passed', /already passed/.test(err('Europe/Berlin', { date: '2026-10-30', time: '13:00' })?.time ?? '') && /already passed/.test(err('Europe/Berlin', { date: '2026-10-30', time: '09:00' })?.time ?? ''));
check('yesterday: "Choose today or a later date."', err('Europe/Berlin', { date: '2026-10-29' })?.date === 'Choose today or a later date.');
check('advance rule, inclusive: exactly 90 days ahead (2027-01-28 13:00) is accepted', err('Europe/Berlin', { date: '2027-01-28', time: '13:00' }) === null);
check('advance rule: 15 minutes beyond 90 days is refused on the DATE field', /at most 90 days/.test(err('Europe/Berlin', { date: '2027-01-28', time: '13:15' })?.date ?? ''));
check('nonexistent local time is refused with the clocks-change message (New York 2027-03-14 02:30), and 03:00 is fine', /clocks change/.test(err('America/New_York', { date: '2027-03-14', time: '02:30' }, new Date('2027-03-10T12:00:00Z'))?.time ?? '') && err('America/New_York', { date: '2027-03-14', time: '03:00' }, new Date('2027-03-10T12:00:00Z')) === null);
const shape = err('UTC', { date: '', time: '19:07', duration: '100', party: '21' });
check('shape errors are all reported at once, one message per field', shape?.date === 'Choose a date.' && shape?.time === 'Choose a start time.' && shape?.duration === 'Choose how long you will stay.' && shape?.party === 'Choose the number of guests.', JSON.stringify(shape));
check('party of 0 and a duration of 29 are refused', err('UTC', { party: '0' })?.party !== undefined && err('UTC', { duration: '29' })?.duration !== undefined);
check('an impossible date (2026-02-30) is "Enter a valid date."', err('UTC', { date: '2026-02-30' })?.date === 'Enter a valid date.');

// ---------- 5. the URL ----------
section('5. search in the URL');
setZone('Pacific/Kiritimati');
const kiritimatiNow = new Date('2026-10-30T11:00:00.000Z'); // 2026-10-31 01:00 there
check('"tomorrow" is tomorrow on the DEVICE calendar (31 Oct 01:00 in Kiritimati -> 1 Nov), not the UTC calendar', defaultSearchValues(kiritimatiNow).date === '2026-11-01');
setZone('UTC');
const parsed = readSearchParams(new URLSearchParams('date=2026-11-03&time=19:00&duration=90&party=2'), NOW);
check('a complete, valid URL is read back exactly and marked complete', parsed.complete && JSON.stringify(parsed.values) === JSON.stringify(base));
const partial = readSearchParams(new URLSearchParams('date=2026-11-03&time=19:00'), NOW);
check('a partial URL keeps what is valid, fills the rest from defaults, and is NOT complete (no automatic search)', !partial.complete && partial.values.date === '2026-11-03' && partial.values.duration === '90' && partial.values.party === '2');
const edited = readSearchParams(new URLSearchParams('date=tomorrow&time=19:07&duration=100&party=99'), NOW);
check('hand-edited nonsense falls back field by field and is not complete', !edited.complete && JSON.stringify(edited.values) === JSON.stringify(defaultSearchValues(NOW)));
check('an empty URL gives the defaults and is not complete', !readSearchParams(new URLSearchParams(''), NOW).complete);
check('writing and reading back is lossless, in a stable order', toSearchParams(base).toString() === 'date=2026-11-03&time=19%3A00&duration=90&party=2' && readSearchParams(toSearchParams(base), NOW).complete);
check('unrelated parameters are ignored', readSearchParams(new URLSearchParams('utm_source=x&date=2026-11-03&time=19:00&duration=90&party=2&evil=<script>'), NOW).complete);

// ---------- 6. error messages ----------
section('6. error messages');
const apiError = (code: string, message = 'SELECT * FROM "User" -- leaked server detail') => new ApiError(409, code, message);
const refresh = (code: string) => describeBookingError(apiError(code), 4).refreshResults;
check('SLOT_TAKEN, TABLE_INACTIVE, NOT_FOUND and CAPACITY_EXCEEDED all refresh the results', ['SLOT_TAKEN', 'TABLE_INACTIVE', 'NOT_FOUND', 'CAPACITY_EXCEEDED'].every(refresh));
check('BOOKING_TIME_INVALID, UNAUTHORIZED, NETWORK_ERROR, INTERNAL_ERROR, VALIDATION_ERROR and unknown codes do not', ['BOOKING_TIME_INVALID', 'UNAUTHORIZED', 'NETWORK_ERROR', 'INTERNAL_ERROR', 'VALIDATION_ERROR', 'SOMETHING_NEW'].every((c) => !refresh(c)));
check('the capacity message names the party size', /party of 4/.test(describeBookingError(apiError('CAPACITY_EXCEEDED'), 4).message));
check('the time-not-bookable message quotes the real limits (60 minutes, 90 days)', /60 minutes/.test(describeBookingError(apiError('BOOKING_TIME_INVALID'), 2).message) && /90 days/.test(describeBookingError(apiError('BOOKING_TIME_INVALID'), 2).message));
check('server wording is NEVER echoed, for any code', ['SLOT_TAKEN', 'TABLE_INACTIVE', 'NOT_FOUND', 'CAPACITY_EXCEEDED', 'BOOKING_TIME_INVALID', 'UNAUTHORIZED', 'NETWORK_ERROR', 'INTERNAL_ERROR', 'VALIDATION_ERROR', 'X'].every((c) => !/SELECT|leaked/.test(describeBookingError(apiError(c), 2).message + describeSearchError(apiError(c)).message)));
check('search errors: network and unknown are retryable, a bad time and bad input are not', describeSearchError(apiError('NETWORK_ERROR')).retryable && describeSearchError(apiError('INTERNAL_ERROR')).retryable && !describeSearchError(apiError('BOOKING_TIME_INVALID')).retryable && !describeSearchError(apiError('VALIDATION_ERROR')).retryable);


// ---------- 7. "My bookings": page number, status, summary, cancel errors ----------
section('7. my bookings');
const page = (query: string) => readPageParam(new URLSearchParams(query));
check('the page limits equal the server pagination schema (page 100000 ok, 100001 refused, our page size ok)', paginationQuerySchema.safeParse({ page: String(MAX_PAGE_NUMBER), pageSize: String(MY_BOOKINGS_PAGE_SIZE) }).success && !paginationQuerySchema.safeParse({ page: String(MAX_PAGE_NUMBER + 1) }).success);
check('?page=1, 2, 37 and the highest allowed page are read as they are', page('page=1') === 1 && page('page=2') === 2 && page('page=37') === 37 && page(`page=${MAX_PAGE_NUMBER}`) === MAX_PAGE_NUMBER);
check('missing, empty, 0, negative, decimal, padded, exponent, spaced, text and too-large pages fall back to 1', ['', 'page=', 'page=0', 'page=-1', 'page=1.5', 'page=01', 'page=1e2', 'page=%202', 'page=abc', 'page=2abc', `page=${MAX_PAGE_NUMBER + 1}`, 'page=99999999999999999999', 'page=%2B2', 'page=0x10'].every((q) => page(q) === 1));
check('every page this reads is one the server accepts', ['page=1', 'page=2', 'page=500', `page=${MAX_PAGE_NUMBER}`].every((q) => paginationQuerySchema.safeParse({ page: String(page(q)) }).success));
check('with a repeated ?page=2&page=3 the first value is used (a defined, harmless choice)', page('page=2&page=3') === 2);
check('page links: page 1 is the plain URL, others carry ?page=n', pageSearch(1) === '' && pageSearch(2) === '?page=2' && pageSearch(0) === '' && pageSearch(40) === '?page=40');

const statusAt = (status: 'CONFIRMED' | 'CANCELLED', startsAt: string) => describeBookingStatus({ status, startsAt }, NOW);
check('confirmed and in the future -> "Confirmed", cancellable', JSON.stringify(statusAt('CONFIRMED', '2026-10-30T12:00:00.001Z')) === JSON.stringify({ label: 'Confirmed', cancellable: true }));
check('confirmed and starting exactly now -> "Past", not cancellable (the server refuses startsAt <= now)', JSON.stringify(statusAt('CONFIRMED', NOW.toISOString())) === JSON.stringify({ label: 'Past', cancellable: false }));
check('confirmed and earlier -> "Past", not cancellable', JSON.stringify(statusAt('CONFIRMED', '2026-10-01T10:00:00.000Z')) === JSON.stringify({ label: 'Past', cancellable: false }));
check('cancelled -> "Cancelled", never cancellable, whether in the future or the past', JSON.stringify(statusAt('CANCELLED', '2027-01-01T10:00:00.000Z')) === JSON.stringify({ label: 'Cancelled', cancellable: false }) && !statusAt('CANCELLED', '2026-01-01T10:00:00.000Z').cancellable);

const summary = (total: number, pageNumber: number, shown: number) => describeListPage({ page: pageNumber, pageSize: 10, total, shown });
check('summary: no bookings, one booking, a full page, a last partial page, a page past the end', summary(0, 1, 0) === 'You have no bookings yet.' && summary(1, 1, 1) === '1 booking.' && summary(25, 2, 10) === '25 bookings. Showing 11–20.' && summary(25, 3, 5) === '25 bookings. Showing 21–25.' && summary(25, 99, 0) === 'There are no bookings on this page.');
check('summary: a page with a single row out of several says which one', summary(11, 2, 1) === '11 bookings. Showing 11.');

const cancelOf = (code: string, message = 'SELECT * FROM "User" -- leaked server detail') => describeCancelError(new ApiError(409, code, message));
check('BOOKING_STARTED, NOT_FOUND and FORBIDDEN reload the list; the other codes do not', ['BOOKING_STARTED', 'NOT_FOUND', 'FORBIDDEN'].every((c) => cancelOf(c).reloadList) && ['UNAUTHORIZED', 'NETWORK_ERROR', 'INTERNAL_ERROR', 'VALIDATION_ERROR', 'SOMETHING_NEW'].every((c) => !cancelOf(c).reloadList));
check('each cancel message says what happened (started / not found / not yours / network / generic)', /already started/.test(cancelOf('BOOKING_STARTED').message) && /couldn't find/.test(cancelOf('NOT_FOUND').message) && /isn't yours/.test(cancelOf('FORBIDDEN').message) && /reach the server/.test(cancelOf('NETWORK_ERROR').message) && /Something went wrong/.test(cancelOf('INTERNAL_ERROR').message));
check('the four distinct cancel messages are all different', new Set(['BOOKING_STARTED', 'NOT_FOUND', 'FORBIDDEN', 'NETWORK_ERROR'].map((c) => cancelOf(c).message)).size === 4);
check('server wording is NEVER echoed by the cancel or list messages, for any code', ['BOOKING_STARTED', 'NOT_FOUND', 'FORBIDDEN', 'UNAUTHORIZED', 'NETWORK_ERROR', 'INTERNAL_ERROR', 'X'].every((c) => !/SELECT|leaked/.test(cancelOf(c).message + describeListError(new ApiError(500, c, 'SELECT leaked')).message)));
check('list errors: always retryable; the network one says so', describeListError(new ApiError(0, 'NETWORK_ERROR', 'x')).retryable && /reach the server/.test(describeListError(new ApiError(0, 'NETWORK_ERROR', 'x')).message) && describeListError(new ApiError(500, 'INTERNAL_ERROR', 'x')).retryable);

console.log(`\n${passed} checks passed, ${failures.length} failed`);
console.log(failures.length === 0 ? 'OK: the client converts, validates and explains booking times exactly as the server expects.' : `FAILED: ${failures.join('; ')}`);
process.exit(failures.length === 0 ? 0 : 1);

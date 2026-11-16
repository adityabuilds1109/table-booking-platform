import { DURATION_VALUES, PARTY_SIZE_VALUES, START_TIME_VALUES } from './bookingLimits';
import { addLocalDays, localDateString } from './timeConversion';

// What the search form holds and what the URL carries. Everything is a string because that is what inputs and URLs are.
// The values are LOCAL ("19:00" on the person's own clock); timeConversion turns them into what the API wants.
export type SearchValues = { date: string; time: string; duration: string; party: string };

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// Tomorrow evening for two: a sensible starting point that already satisfies the notice rule.
export function defaultSearchValues(now: Date = new Date()): SearchValues {
  return { date: localDateString(addLocalDays(now, 1)), time: '19:00', duration: '90', party: '2' };
}

const isOneOf = (allowed: readonly string[], value: string | null): value is string => value !== null && allowed.includes(value);

// Reads /?date=2026-11-03&time=19:00&duration=90&party=2. Anything missing or hand-edited into nonsense falls back to the
// default for that field, so the form is always usable; `complete` is true only when all four were present and valid, which
// is the signal to run the search without the person pressing the button (reload, back, return from login).
export function readSearchParams(params: URLSearchParams, now: Date = new Date()): { values: SearchValues; complete: boolean } {
  const defaults = defaultSearchValues(now);
  const date = params.get('date');
  const time = params.get('time');
  const duration = params.get('duration');
  const party = params.get('party');

  const validDate = date !== null && DATE_SHAPE.test(date);
  const validTime = isOneOf(START_TIME_VALUES, time);
  const validDuration = isOneOf(DURATION_VALUES, duration);
  const validParty = isOneOf(PARTY_SIZE_VALUES, party);

  return {
    values: {
      date: validDate ? date : defaults.date,
      time: validTime ? time : defaults.time,
      duration: validDuration ? duration : defaults.duration,
      party: validParty ? party : defaults.party,
    },
    complete: validDate && validTime && validDuration && validParty,
  };
}

export function toSearchParams({ date, time, duration, party }: SearchValues): URLSearchParams {
  return new URLSearchParams({ date, time, duration, party });
}

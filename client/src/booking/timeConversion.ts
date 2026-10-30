// The person types a LOCAL date and time; the API speaks UTC. This file is the only place that converts, in both directions.
// Why it needs care:
//  - the UTC *date* can differ from the local date (00:30 on 3 Nov in UTC+2 is 22:30 on 2 Nov in UTC), so the date sent to the
//    API is taken from the converted instant, never from the date box;
//  - at a clock change JavaScript does not complain: asking for 02:30 on the night clocks go forward silently gives 03:30,
//    i.e. a different booking than the one asked for, so that case is detected and reported;
//  - when clocks go back, a local time happens twice. It is detected and flagged, and times are always shown with their
//    zone abbreviation, so which one was meant is visible.
// `npm run check:time-conversion` proves all of this over many time zones against the server's own validation.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_MINUTE = 60_000;
const AMBIGUITY_WINDOW_MINUTES = 120;
const AMBIGUITY_STEP_MINUTES = 15;

export type LocalSlot = { date: string; time: string };

export type SlotConversion =
  | {
      ok: true;
      instant: Date;
      // The same instant in the forms the API wants.
      startsAt: string; // "2026-11-03T18:00:00.000Z", for POST /bookings
      utcDate: string; // "2026-11-03", for GET /tables/availability
      utcTime: string; // "18:00", for GET /tables/availability
      // This local time happens twice (clocks go back). We use the first one; the display shows the zone abbreviation.
      ambiguous: boolean;
    }
  // 'invalid': not a real date or time. 'nonexistent': skipped by a clock change (e.g. 02:30 when clocks jump 02:00 -> 03:00).
  | { ok: false; reason: 'invalid' | 'nonexistent' };

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function sameLocalReading(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

// Does another instant, within two hours either side, show the very same local clock reading?
function isAmbiguous(instant: Date): boolean {
  for (let offset = -AMBIGUITY_WINDOW_MINUTES; offset <= AMBIGUITY_WINDOW_MINUTES; offset += AMBIGUITY_STEP_MINUTES) {
    if (offset !== 0 && sameLocalReading(instant, new Date(instant.getTime() + offset * MS_PER_MINUTE))) return true;
  }
  return false;
}

export function localSlotToUtc({ date, time }: LocalSlot): SlotConversion {
  const dateParts = DATE_PATTERN.exec(date);
  const timeParts = TIME_PATTERN.exec(time);
  if (!dateParts || !timeParts) return { ok: false, reason: 'invalid' };

  const [year, month, day] = [Number(dateParts[1]), Number(dateParts[2]), Number(dateParts[3])];
  const [hour, minute] = [Number(timeParts[1]), Number(timeParts[2])];
  // Years below 1000 are refused: `new Date(99, ...)` would quietly mean 1999.
  if (year < 1000 || !isRealCalendarDate(year, month, day)) return { ok: false, reason: 'invalid' };

  // The browser applies the device's time zone to these local parts.
  const instant = new Date(year, month - 1, day, hour, minute, 0, 0);
  const isWhatWasAsked =
    instant.getFullYear() === year &&
    instant.getMonth() === month - 1 &&
    instant.getDate() === day &&
    instant.getHours() === hour &&
    instant.getMinutes() === minute;
  if (!isWhatWasAsked) return { ok: false, reason: 'nonexistent' };

  const iso = instant.toISOString(); // always UTC
  return { ok: true, instant, startsAt: iso, utcDate: iso.slice(0, 10), utcTime: iso.slice(11, 16), ambiguous: isAmbiguous(instant) };
}

// ---------- local dates ----------

const pad = (value: number): string => String(value).padStart(2, '0');

// "2026-11-03" for the date as the device's calendar shows it (not the UTC date).
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local midnight `days` days after `date`'s local midnight; calendar-correct across clock changes (a "day" can be 23 or 25 h).
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// ---------- showing times back ----------

// Both default to the browser's own locale and time zone; they are parameters only so the check script can pin them.
export type DisplayOptions = { locale?: string | undefined; timeZone?: string | undefined };

function formatPart(instant: Date, options: Intl.DateTimeFormatOptions, { locale, timeZone }: DisplayOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(instant);
}

const dayLabel = (instant: Date, display: DisplayOptions) =>
  formatPart(instant, { weekday: 'short', day: 'numeric', month: 'short' }, display);
// 24-hour clocks read best padded ("01:00", "19:00", matching the start-time list); 12-hour clocks read best unpadded ("7:00 PM").
function clockFormat(locale: string | undefined): Intl.DateTimeFormatOptions {
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return { hour: cycle === 'h23' || cycle === 'h24' ? '2-digit' : 'numeric', minute: '2-digit' };
}
const clockLabel = (instant: Date, display: DisplayOptions) => formatPart(instant, clockFormat(display.locale), display);
const calendarDay = (instant: Date, display: DisplayOptions) =>
  formatPart(instant, { year: 'numeric', month: '2-digit', day: '2-digit' }, { ...display, locale: 'en-CA' });

// "CET", "EDT", "GMT+5:45": the zone's short name at that instant (it changes with daylight saving).
export function zoneAbbreviation(instant: Date, { locale, timeZone }: DisplayOptions = {}): string {
  const part = new Intl.DateTimeFormat(locale, { timeZoneName: 'short', timeZone })
    .formatToParts(instant)
    .find((candidate) => candidate.type === 'timeZoneName');
  return part?.value ?? '';
}

// "Tue, 3 Nov, 19:00 CET"
export function formatInstant(iso: string, display: DisplayOptions = {}): string {
  const instant = new Date(iso);
  return `${dayLabel(instant, display)}, ${clockLabel(instant, display)} ${zoneAbbreviation(instant, display)}`;
}

// "Tue, 3 Nov, 19:00-20:30 CET", or with both days if it runs past midnight. The zone is shown once unless it changes
// during the booking (a clock change), in which case each end carries its own.
export function formatTimeRange(startIso: string, endIso: string, display: DisplayOptions = {}): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startZone = zoneAbbreviation(start, display);
  const endZone = zoneAbbreviation(end, display);
  const sameDay = calendarDay(start, display) === calendarDay(end, display);

  if (sameDay && startZone === endZone) {
    return `${dayLabel(start, display)}, ${clockLabel(start, display)}–${clockLabel(end, display)} ${startZone}`;
  }
  const startText = `${dayLabel(start, display)}, ${clockLabel(start, display)} ${startZone}`;
  const endText = `${sameDay ? '' : `${dayLabel(end, display)}, `}${clockLabel(end, display)} ${endZone}`;
  return `${startText} – ${endText}`;
}

// The label of a start-time option, in the person's own clock style: "7:00 PM" or "19:00".
export function formatStartTimeLabel(value: string, locale?: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  // Formatted as UTC so the device's time zone (and its clock changes) can never shift the label.
  const reference = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(locale, { ...clockFormat(locale), timeZone: 'UTC' }).format(reference);
}

// "Europe/Berlin (CET)": which zone the times on the page are in, for the sentence under the time fields.
export function describeDeviceTimeZone(at: Date, display: DisplayOptions = {}): string {
  const name = new Intl.DateTimeFormat(display.locale, { timeZone: display.timeZone }).resolvedOptions().timeZone;
  return `${name} (${zoneAbbreviation(at, display)})`;
}

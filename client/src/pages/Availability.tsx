import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { loginStateFor } from '../auth/loginRedirect';
import { useAuth } from '../auth/useAuth';
import SelectField, { type SelectOption } from '../components/SelectField';
import TextField from '../components/TextField';
import BookingConfirmation from '../booking/BookingConfirmation';
import { useBookTable } from '@table-booking/shared/react';
import AvailabilityResults, { type SearchSummary } from '../booking/AvailabilityResults';
import { BOOKING_LIMITS, DURATION_VALUES, PARTY_SIZE_VALUES, START_TIME_VALUES, formatDuration } from '@table-booking/shared/booking';
import { readSearchParams, toSearchParams, type SearchValues } from '@table-booking/shared/booking';
import { validateSearch, type SearchErrors } from '@table-booking/shared/booking';
import type { AvailableTable } from '@table-booking/shared/api';
import { addLocalDays, describeDeviceTimeZone, formatStartTimeLabel, localDateString, zoneAbbreviation } from '@table-booking/shared/booking';
import { useAvailability } from '@table-booking/shared/react';

type Field = keyof SearchValues;
const FIELD_ORDER: readonly Field[] = ['date', 'time', 'duration', 'party'];
const MS_PER_MINUTE = 60_000;

// One cell of the search bar. Borders: a line above each stacked cell (1 column), a line above rows 2+ and left of the second
// column (2 columns), a line left of every cell but the first (one row). Cells never have both a top and a left line at lg.
const SEARCH_CELL =
  'border-t border-line-soft first:border-t-0 sm:border-t-0 sm:nth-[n+3]:border-t sm:even:border-l lg:border-t-0 lg:border-l lg:first:border-l-0';

const START_TIME_OPTIONS: readonly SelectOption[] = START_TIME_VALUES.map((value) => ({ value, label: formatStartTimeLabel(value) }));
const DURATION_OPTIONS: readonly SelectOption[] = DURATION_VALUES.map((value) => ({ value, label: formatDuration(Number(value)) }));
const PARTY_OPTIONS: readonly SelectOption[] = PARTY_SIZE_VALUES.map((value) => ({ value, label: value }));

export default function Availability() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const urlKey = params.toString();

  // The URL is the source of truth for what was SEARCHED (so reload, Back and returning from login work); `values` is what
  // the form currently shows. Decided once per URL, not per render, so the clock passing a boundary cannot flip a search.
  const fromUrl = useMemo(() => {
    const { values, complete } = readSearchParams(new URLSearchParams(urlKey));
    return { values, validation: complete ? validateSearch(values) : null };
  }, [urlKey]);

  const [values, setValues] = useState<SearchValues>(fromUrl.values);
  // False until the first submit attempt (or a URL whose search is invalid), so nobody is told "Choose a date" before trying.
  const [submitted, setSubmitted] = useState(fromUrl.validation?.ok === false);
  const [syncedKey, setSyncedKey] = useState(urlKey);

  const refs = {
    date: useRef<HTMLInputElement>(null),
    time: useRef<HTMLSelectElement>(null),
    duration: useRef<HTMLSelectElement>(null),
    party: useRef<HTMLSelectElement>(null),
  };

  const search = fromUrl.validation?.ok ? fromUrl.validation.search : null;
  const { state, reload } = useAvailability(search?.query ?? null);
  const booking = useBookTable(search, reload);

  // When the URL changes (Back/Forward, a link), the form follows it: "adjusting state while rendering", React's pattern
  // for state that derives from something else.
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setValues(fromUrl.values);
    setSubmitted(fromUrl.validation?.ok === false);
    booking.reset();
  }

  const validation = validateSearch(values);
  const errors: SearchErrors = submitted && !validation.ok ? validation.errors : {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const result = validateSearch(values);
    if (!result.ok) {
      // Nothing is sent. Focus the first field with a problem; its error is part of its accessible description.
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (firstInvalid) refs[firstInvalid].current?.focus();
      return;
    }
    const next = toSearchParams(values);
    // The same search again changes no URL (so no new search would start); repeat it explicitly.
    if (next.toString() === urlKey) reload();
    else setParams(next);
  }

  // The message after a failed booking gets focus, so it is read out and a keyboard user is not left on a vanished button.
  const messageRef = useRef<HTMLParagraphElement>(null);
  const failedMessage = booking.state.phase === 'failed' ? booking.state.message : null;
  useEffect(() => {
    if (failedMessage !== null) messageRef.current?.focus();
  }, [failedMessage]);

  function handleBook(table: AvailableTable) {
    // Anonymous: nothing is sent. They go to /login and come back to this same search (the URL is remembered).
    if (auth.status === 'anonymous') {
      void navigate('/login', { state: loginStateFor(location) });
      return;
    }
    if (auth.status === 'authenticated') void booking.book(table);
    else booking.fail("We couldn't check that you are logged in. Please try again in a moment.");
  }

  const pending = booking.state.phase === 'pending' ? booking.state : null;
  const now = new Date();
  const summary: SearchSummary | null =
    search === null
      ? null
      : {
          startsAt: search.slot.startsAt,
          endsAt: new Date(search.slot.instant.getTime() + search.durationMinutes * MS_PER_MINUTE).toISOString(),
          partySize: search.partySize,
          ambiguousZone: search.slot.ambiguous ? zoneAbbreviation(search.slot.instant) : null,
        };

  return (
    <section>
      <title>Find a table – Table Booking</title>
      <div className="bg-ink">
        <div className="mx-auto max-w-page px-4 pt-14 pb-22 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">Reservations</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] text-white sm:text-[52px]">
            Find your table
          </h1>
          <p className="mt-4 max-w-2xl text-on-ink-muted">
            Times are in your device&apos;s time zone: {describeDeviceTimeZone(now)}. All fields are required.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-page px-4 pb-12 sm:px-8">
        <form
          role="search"
          aria-label="Find a table"
          noValidate
          onSubmit={handleSubmit}
          className="relative -mt-12 grid grid-cols-1 overflow-hidden rounded-[18px] bg-white shadow-raised sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
        >
          <div className={SEARCH_CELL}>
            <TextField
              variant="segment"
              ref={refs.date}
              label="Date"
              name="date"
              type="date"
              autoComplete="off"
              min={localDateString(now)}
              max={localDateString(addLocalDays(now, BOOKING_LIMITS.maxAdvanceDays))}
              value={values.date}
              onChange={(value) => setValues((current) => ({ ...current, date: value }))}
              error={errors.date}
            />
          </div>
          <div className={SEARCH_CELL}>
            <SelectField
              variant="segment"
              ref={refs.time}
              label="Start time"
              name="time"
              options={START_TIME_OPTIONS}
              value={values.time}
              onChange={(value) => setValues((current) => ({ ...current, time: value }))}
              error={errors.time}
            />
          </div>
          <div className={SEARCH_CELL}>
            <SelectField
              variant="segment"
              ref={refs.duration}
              label="Length of stay"
              name="duration"
              options={DURATION_OPTIONS}
              value={values.duration}
              onChange={(value) => setValues((current) => ({ ...current, duration: value }))}
              error={errors.duration}
            />
          </div>
          <div className={SEARCH_CELL}>
            <SelectField
              variant="segment"
              ref={refs.party}
              label="Guests"
              name="party"
              options={PARTY_OPTIONS}
              value={values.party}
              onChange={(value) => setValues((current) => ({ ...current, party: value }))}
              error={errors.party}
            />
          </div>
          <div className={`${SEARCH_CELL} p-3 sm:col-span-2 lg:col-span-1`}>
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 font-semibold text-white hover:bg-ink-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:h-full"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brass"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Find tables
            </button>
          </div>
        </form>

        {/* Always in the page (empty until needed), like the results status: alerts put into an existing region are announced reliably. */}
        <div role="alert" className="mt-4">
          {failedMessage !== null && (
            <p
              ref={messageRef}
              tabIndex={-1}
              className="rounded-xl border border-danger-line bg-danger-soft p-3 text-danger-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {failedMessage}
            </p>
          )}
        </div>
        {auth.status === 'loading' && <p className="mt-2 text-sm text-muted">Checking your login…</p>}

        {booking.state.phase === 'booked' ? (
          <BookingConfirmation
            booking={booking.state.booking}
            tableName={booking.state.tableName}
            onSearchAgain={() => {
              booking.reset();
              reload();
            }}
          />
        ) : (
          <AvailabilityResults
            state={state}
            summary={summary}
            onRetry={reload}
            onBook={handleBook}
            bookingTableId={pending?.tableId ?? null}
            bookingTableName={pending?.tableName ?? null}
            bookDisabled={auth.status === 'loading'}
          />
        )}
      </div>
    </section>
  );
}

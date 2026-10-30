import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import SelectField, { type SelectOption } from '../components/SelectField';
import TextField from '../components/TextField';
import AvailabilityResults, { type SearchSummary } from '../booking/AvailabilityResults';
import { BOOKING_LIMITS, DURATION_VALUES, PARTY_SIZE_VALUES, START_TIME_VALUES, formatDuration } from '../booking/bookingLimits';
import { readSearchParams, toSearchParams, type SearchValues } from '../booking/searchParams';
import { validateSearch, type SearchErrors } from '../booking/searchValidation';
import { addLocalDays, describeDeviceTimeZone, formatStartTimeLabel, localDateString, zoneAbbreviation } from '../booking/timeConversion';
import { useAvailability } from '../booking/useAvailability';

type Field = keyof SearchValues;
const FIELD_ORDER: readonly Field[] = ['date', 'time', 'duration', 'party'];
const MS_PER_MINUTE = 60_000;

const START_TIME_OPTIONS: readonly SelectOption[] = START_TIME_VALUES.map((value) => ({ value, label: formatStartTimeLabel(value) }));
const DURATION_OPTIONS: readonly SelectOption[] = DURATION_VALUES.map((value) => ({ value, label: formatDuration(Number(value)) }));
const PARTY_OPTIONS: readonly SelectOption[] = PARTY_SIZE_VALUES.map((value) => ({ value, label: value }));

export default function Availability() {
  const [params, setParams] = useSearchParams();
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
  // When the URL changes (Back/Forward, a link), the form follows it: "adjusting state while rendering", React's pattern
  // for state that derives from something else.
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setValues(fromUrl.values);
    setSubmitted(fromUrl.validation?.ok === false);
  }

  const refs = {
    date: useRef<HTMLInputElement>(null),
    time: useRef<HTMLSelectElement>(null),
    duration: useRef<HTMLSelectElement>(null),
    party: useRef<HTMLSelectElement>(null),
  };

  const search = fromUrl.validation?.ok ? fromUrl.validation.search : null;
  const { state, reload } = useAvailability(search?.query ?? null);

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
      <h1 className="text-2xl font-bold">Find a table</h1>
      <p className="mt-2 text-slate-600">
        Times are in your device&apos;s time zone: {describeDeviceTimeZone(now)}. All fields are required.
      </p>

      <form role="search" aria-label="Find a table" noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
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
          <SelectField
            ref={refs.time}
            label="Start time"
            name="time"
            options={START_TIME_OPTIONS}
            value={values.time}
            onChange={(value) => setValues((current) => ({ ...current, time: value }))}
            error={errors.time}
          />
          <SelectField
            ref={refs.duration}
            label="Length of stay"
            name="duration"
            options={DURATION_OPTIONS}
            value={values.duration}
            onChange={(value) => setValues((current) => ({ ...current, duration: value }))}
            error={errors.duration}
          />
          <SelectField
            ref={refs.party}
            label="Guests"
            name="party"
            options={PARTY_OPTIONS}
            value={values.party}
            onChange={(value) => setValues((current) => ({ ...current, party: value }))}
            error={errors.party}
          />
        </div>
        <button
          type="submit"
          className="rounded border border-transparent bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Find tables
        </button>
      </form>

      <AvailabilityResults state={state} summary={summary} onRetry={reload} />
    </section>
  );
}

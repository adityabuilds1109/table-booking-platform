// Midnight-based UTC helper shared by the booking tests. Dates are built relative to "now" so they always satisfy the
// notice / max-advance rules, whenever the tests run.
export function utcDateAt(daysAhead: number, hour: number, minute = 0): Date {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysAhead, hour, minute));
}

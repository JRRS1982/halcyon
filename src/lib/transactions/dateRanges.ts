// The filter drawer's one-tap date ranges. Pure, and driven by an injected
// "today" so the presets can be pinned by tests rather than by the clock.
//
// Everything is computed in UTC to match Transaction.date, which is a @db.Date
// stored at UTC midnight — using local getters here would shift a range by a
// day for anyone west of Greenwich.

export type DatePreset = {
  label: string;
  /** Inclusive YYYY-MM-DD bounds, the same shape the URL and inputs use. */
  from: string;
  to: string;
};

const iso = (date: Date): string => date.toISOString().slice(0, 10);

const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month, day));

// Day 0 of the next month is the last day of this one, so February resolves to
// 28 or 29 without a leap-year table.
const endOfMonth = (year: number, month: number): Date =>
  utc(year, month + 1, 0);

export function datePresets(today: Date): DatePreset[] {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const to = iso(today);

  return [
    {
      label: "This month",
      from: iso(utc(year, month, 1)),
      to: iso(endOfMonth(year, month)),
    },
    {
      // Date.UTC normalises an out-of-range month across the year boundary,
      // so month - 2 in January is November of the previous year.
      label: "Last 3 months",
      from: iso(utc(year, month - 2, 1)),
      to,
    },
    { label: "This year", from: iso(utc(year, 0, 1)), to },
  ];
}

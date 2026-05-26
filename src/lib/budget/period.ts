// Date helpers for FinancialPeriod. v1 uses UTC calendar months only.

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type PeriodRange = {
  startDate: Date;
  endDate: Date;
  label: string;
};

// Returns the calendar-month range for a given (year, month) — month is
// 0-indexed (0=Jan, 11=Dec). startDate is the first of the month at 00:00 UTC;
// endDate is the last day of the month at 00:00 UTC. Label is "<Month> <Year>".
export function monthRangeFor(year: number, month: number): PeriodRange {
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0));
  const label = `${MONTH_NAMES[month]} ${year}`;
  return { startDate, endDate, label };
}

// Returns the calendar-month range containing `now`, in UTC.
export function currentMonthRange(now: Date = new Date()): PeriodRange {
  return monthRangeFor(now.getUTCFullYear(), now.getUTCMonth());
}

// Returns the (year, month) immediately before `date` (UTC), handling year
// rollover. Month is 0-indexed.
export function previousMonth(date: Date): { year: number; month: number } {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

// Returns the (year, month) immediately after `date` (UTC), handling year
// rollover. Month is 0-indexed.
export function nextMonth(date: Date): { year: number; month: number } {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

// Short month labels (3-letter) for picker UI.
export const MONTH_LABELS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Format (year, month-0-indexed) → "YYYY-MM" for the ?ym= URL param.
export function formatYm(year: number, month: number): string {
  const m = String(month + 1).padStart(2, "0");
  return `${year}-${m}`;
}

// Parse "YYYY-MM" → { year, month-0-indexed } or null if malformed.
export function parseYm(s: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(s);
  if (!match) return null;
  const year = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(year) || m < 1 || m > 12) return null;
  return { year, month: m - 1 };
}

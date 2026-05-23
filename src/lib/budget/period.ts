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

// Returns the calendar-month range that `now` falls inside, in UTC.
// startDate is the first of the month at 00:00 UTC; endDate is the last day
// of the month at 00:00 UTC. Label is "<Month> <Year>".
export function currentMonthRange(now: Date = new Date()): PeriodRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 0));
  const label = `${MONTH_NAMES[month]} ${year}`;

  return { startDate, endDate, label };
}

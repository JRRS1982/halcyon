const MONTHS = [
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
];

// "2026-01-01" → "1 Jan 2026". Hand-rolled rather than Intl for the same
// reason as src/lib/settings/currency.ts: platform locale data varies, and a
// label that shifts between machines is a test that fails somewhere else.
export function humanDate(isoDate: string, withYear = true): string {
  const [year = "", month = "", day = ""] = isoDate.slice(0, 10).split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${name}${withYear ? ` ${year}` : ""}`;
}

/** A row date as a reader says it: "28 Oct", with the year only when it isn't this one. */
export function shortDate(isoDate: string, today: Date): string {
  const isThisYear = isoDate.slice(0, 4) === String(today.getUTCFullYear());
  return humanDate(isoDate, !isThisYear);
}

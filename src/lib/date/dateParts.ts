// Day/month/year as the user types them, before they are a date.
//
// Kept separate from the component so the awkward cases — a 31st that does not
// exist in the chosen month, a two-digit year, a month typed before a day —
// are decided by pure functions with tests, rather than inside an input's
// onChange.
export type DateParts = { day: string; month: string; year: string };

export const EMPTY_PARTS: DateParts = { day: "", month: "", year: "" };

/** Splits a stored `YYYY-MM-DD` into its fields. Anything else gives blanks. */
export function partsFromIso(iso: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return EMPTY_PARTS;
  const [, year, month, day] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  return { day, month, year };
}

/**
 * The `YYYY-MM-DD` these fields describe, or "" if they do not describe a real
 * date yet.
 *
 * Returning "" rather than a partial string is what keeps a half-typed date
 * from reaching the server: callers treat "" as "no date", exactly as the
 * empty native input did.
 *
 * A calendar round-trip rejects the days that do not exist — 31/02 becomes
 * 02/03 if you only build a Date and read it back, so the parts are compared
 * against what the Date actually holds.
 */
export function isoFromParts({ day, month, year }: DateParts): string {
  if (!/^\d{1,2}$/.test(day)) return "";
  if (!/^\d{1,2}$/.test(month)) return "";
  if (!/^\d{4}$/.test(year)) return "";

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return "";
  }

  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

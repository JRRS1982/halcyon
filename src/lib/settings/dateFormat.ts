// The order a date is written and typed in: day-month-year, month-day-year or
// year-month-day. Chosen in Settings → Format, and read by every date field
// (DateField), which lays its three parts out in this order.
//
// The app stores and sends dates as YYYY-MM-DD throughout; this decides only
// how a date is shown and entered. It exists because the browser's own date
// box follows the browser's language rather than the user, so a UK user on a
// US-language browser was shown mm/dd/yyyy with no way to change it.

export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

// UK-first, like the currency default. Mirror this in the UserSettings
// dateFormat column default (prisma/schema.prisma).
export const DEFAULT_DATE_FORMAT: DateFormat = "DMY";

export type DatePart = "day" | "month" | "year";

export const DATE_FORMAT_SPEC: Record<
  DateFormat,
  {
    order: readonly [DatePart, DatePart, DatePart];
    separator: string;
    pattern: string;
  }
> = {
  DMY: {
    order: ["day", "month", "year"],
    separator: "/",
    pattern: "DD/MM/YYYY",
  },
  MDY: {
    order: ["month", "day", "year"],
    separator: "/",
    pattern: "MM/DD/YYYY",
  },
  YMD: {
    order: ["year", "month", "day"],
    separator: "-",
    pattern: "YYYY-MM-DD",
  },
};

export function isDateFormat(value: unknown): value is DateFormat {
  return (
    typeof value === "string" &&
    (DATE_FORMATS as readonly string[]).includes(value)
  );
}

/**
 * A YYYY-MM-DD date written in the chosen order, e.g. "31/12/2026" for DMY.
 * Returns the input unchanged when it is not a YYYY-MM-DD date, so a blank or
 * half-typed value never renders as a garbled one.
 */
export function formatDate(iso: string, format: DateFormat): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year = "", month = "", day = ""] = match;
  const parts: Record<DatePart, string> = { day, month, year };
  const { order, separator } = DATE_FORMAT_SPEC[format];
  return order.map((part) => parts[part]).join(separator);
}

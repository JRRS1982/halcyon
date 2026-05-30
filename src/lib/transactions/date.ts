// Parses a date cell using a user-chosen field order, resolving the classic
// DD/MM vs MM/DD ambiguity at the import mapping step rather than guessing.
// Accepts '/', '-' and '.' separators and two-digit years (expanded to the
// 2000s). Dates are anchored at UTC midnight to match how budget periods are
// keyed, avoiding timezone drift. Returns null for malformed or impossible
// dates.

export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export function parseDate(raw: string, format: DateFormat): Date | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split(/[-/.]/);
  if (parts.length !== 3 || !parts.every((part) => /^\d+$/.test(part))) {
    return null;
  }
  const nums = parts.map((part) => Number.parseInt(part, 10));

  let day: number;
  let month: number;
  let year: number;
  if (format === "DMY") [day, month, year] = nums;
  else if (format === "MDY") [month, day, year] = nums;
  else [year, month, day] = nums;

  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

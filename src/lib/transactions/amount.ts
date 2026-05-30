// Parses a bank-statement amount cell into a signed number, or null if it
// isn't a number. Tolerates currency symbols, comma thousands separators,
// surrounding whitespace, a leading +/-, and accounting-style parentheses for
// negatives. Assumes dot-decimal / comma-thousands (the common en export
// convention); decimal-comma locales are out of scope for v1.

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[()]/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9.+-]/g, "");

  if (!/[0-9]/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  return negative ? -Math.abs(value) : value;
}

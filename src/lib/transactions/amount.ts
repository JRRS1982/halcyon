// Parses a bank-statement amount cell into a signed number, or null if it
// isn't a number. Tolerates currency symbols, comma thousands separators,
// surrounding whitespace, a leading +/-, accounting-style parentheses for
// negatives, and trailing DR/CR debit/credit markers (a common UK/legacy
// export convention). Assumes dot-decimal / comma-thousands (the common en
// export convention); decimal-comma locales are out of scope for v1.

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Sign markers: accounting parens and a trailing "DR" both denote a debit
  // (negative); a trailing "CR" denotes a credit (positive). Detected before
  // the letters are stripped below.
  const parenNegative = /^\(.*\)$/.test(trimmed);
  const debitMarker = /(?:^|[\s\d])DR$/i.test(trimmed);
  const creditMarker = /(?:^|[\s\d])CR$/i.test(trimmed);

  const cleaned = trimmed
    .replace(/[()]/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9.+-]/g, "");

  if (!/[0-9]/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  if (parenNegative || debitMarker) return -Math.abs(value);
  if (creditMarker) return Math.abs(value);
  return value;
}

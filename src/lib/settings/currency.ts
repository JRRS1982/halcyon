// Currency codes the user can pick in /settings, plus the small amount of
// metadata the UI needs to render amounts (symbol + name). Kept small on
// purpose — v1 only supports a curated list. Add codes by extending both
// CURRENCY_CODES and CURRENCY_META; the rest of the app reads from here.

export const CURRENCY_CODES = [
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "NONE",
] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; name: string }
> = {
  USD: { symbol: "$", name: "US dollar" },
  GBP: { symbol: "£", name: "Pound sterling" },
  EUR: { symbol: "€", name: "Euro" },
  CAD: { symbol: "C$", name: "Canadian dollar" },
  AUD: { symbol: "A$", name: "Australian dollar" },
  // No symbol — amounts render as plain numbers.
  NONE: { symbol: "", name: "No symbol" },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (CURRENCY_CODES as readonly string[]).includes(value)
  );
}

export function symbolFor(code: string): string {
  return isCurrencyCode(code) ? CURRENCY_META[code].symbol : "$";
}

// ─── Number formatting ────────────────────────────────────────────────────

// How the digits of an amount are rendered, independent of the currency
// symbol. Each preset fixes a thousands separator, a decimal separator, and
// a number of decimal places. Default is comma thousands + no decimals.
export const NUMBER_FORMATS = [
  "COMMA_0",
  "COMMA_2",
  "DOT_0",
  "DOT_2",
  "SPACE_0",
  "SPACE_2",
] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export const DEFAULT_NUMBER_FORMAT: NumberFormat = "COMMA_0";

export const NUMBER_FORMAT_SPEC: Record<
  NumberFormat,
  { thousands: string; decimal: string; decimals: number; example: string }
> = {
  COMMA_0: { thousands: ",", decimal: ".", decimals: 0, example: "1,234" },
  COMMA_2: { thousands: ",", decimal: ".", decimals: 2, example: "1,234.56" },
  DOT_0: { thousands: ".", decimal: ",", decimals: 0, example: "1.234" },
  DOT_2: { thousands: ".", decimal: ",", decimals: 2, example: "1.234,56" },
  SPACE_0: { thousands: " ", decimal: ",", decimals: 0, example: "1 234" },
  SPACE_2: { thousands: " ", decimal: ",", decimals: 2, example: "1 234,56" },
};

export function isNumberFormat(value: unknown): value is NumberFormat {
  return (
    typeof value === "string" &&
    (NUMBER_FORMATS as readonly string[]).includes(value)
  );
}

// Render a non-negative number per the preset. Built by hand rather than via
// Intl locales so the output exactly matches the settings-page preview (Intl
// locale separators — especially the French space — vary by platform).
function formatDigits(n: number, fmt: NumberFormat): string {
  const spec = NUMBER_FORMAT_SPEC[fmt];
  const fixed = n.toFixed(spec.decimals);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, spec.thousands);
  return fracPart ? `${grouped}${spec.decimal}${fracPart}` : grouped;
}

// Format a number per the preset, with no currency symbol — e.g. "1,234".
// Used by the editable amount cells to show the formatted value when not
// being edited.
export function formatNumber(
  n: number,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${formatDigits(Math.abs(n), fmt)}`;
}

// ─── Live (mid-typing) number formatting ────────────────────────────────────
// The editable amount cells group the integer part with thousands separators
// as the user types, while leaving the decimal portion exactly as typed (no
// padding) so entering "1234.5" isn't fought by re-formatting.

// A char counts as "significant" for caret tracking if it survives regrouping:
// a digit or the decimal separator (group separators are inserted/removed).
function isSignificant(ch: string, decimal: string): boolean {
  return /\d/.test(ch) || ch === decimal;
}

// Regroup a partially-typed string: strip existing thousands separators, keep
// digits and at most one decimal separator, then group the integer part. A
// trailing decimal separator and any typed decimals are preserved as-is.
export function groupForEditing(
  raw: string,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): string {
  const spec = NUMBER_FORMAT_SPEC[fmt];
  const withoutGroups = raw.split(spec.thousands).join("");
  const decIdx = withoutGroups.indexOf(spec.decimal);
  const digits = (s: string) => s.replace(/\D/g, "");
  const group = (intDigits: string) =>
    intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, spec.thousands);

  if (decIdx === -1) return group(digits(withoutGroups));

  const intPart = group(digits(withoutGroups.slice(0, decIdx)));
  const fracPart = digits(withoutGroups.slice(decIdx + spec.decimal.length));
  return `${intPart}${spec.decimal}${fracPart}`;
}

// Parse a (possibly partially-typed, grouped) editable string back to a number.
// Empty or decimal-only input is 0.
export function parseEditable(
  raw: string,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): number {
  const spec = NUMBER_FORMAT_SPEC[fmt];
  const normalized = raw
    .split(spec.thousands)
    .join("")
    .replace(spec.decimal, ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

// After regrouping shifts separators around, place the caret just after the
// Nth significant char (digits + decimal sep) so it stays where the user was
// typing rather than jumping to the end.
export function caretAfterSignificant(
  formatted: string,
  significantCount: number,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): number {
  if (significantCount <= 0) return 0;
  const { decimal } = NUMBER_FORMAT_SPEC[fmt];
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (isSignificant(formatted[i], decimal)) {
      seen++;
      if (seen === significantCount) return i + 1;
    }
  }
  return formatted.length;
}

// Count significant chars (digits + decimal sep) to the left of `caret` in
// `raw` — the anchor for caretAfterSignificant after regrouping.
export function significantBefore(
  raw: string,
  caret: number,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): number {
  const { decimal } = NUMBER_FORMAT_SPEC[fmt];
  let count = 0;
  for (let i = 0; i < caret && i < raw.length; i++) {
    if (isSignificant(raw[i], decimal)) count++;
  }
  return count;
}

// Format an amount in the user's currency + number format — e.g. "£1,234".
// A negative amount gets a leading minus before the symbol ("−£1,234").
export function formatAmount(
  code: string,
  n: number,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${symbolFor(code)}${formatDigits(Math.abs(n), fmt)}`;
}

// Format a signed amount — used by variance cells.
//   0  → "£0"
//   +n → "+£1,234"
//   −n → "−£1,234"
export function formatSignedAmount(
  code: string,
  n: number,
  fmt: NumberFormat = DEFAULT_NUMBER_FORMAT,
): string {
  const sym = symbolFor(code);
  if (n === 0) return `${sym}${formatDigits(0, fmt)}`;
  const body = `${sym}${formatDigits(Math.abs(n), fmt)}`;
  return n > 0 ? `+${body}` : `−${body}`;
}

// Currency codes the user can pick in /settings, plus the small amount of
// metadata the UI needs to render amounts (symbol + name). Kept small on
// purpose — v1 only supports a curated list. Add codes by extending both
// CURRENCY_CODES and CURRENCY_META; the rest of the app reads from here.

export const CURRENCY_CODES = ["USD", "GBP", "EUR", "CAD", "AUD"] as const;
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

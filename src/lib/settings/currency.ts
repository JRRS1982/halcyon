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

// Format a non-negative amount in the user's currency — e.g. "$1,234.56".
// Used by total cells (budget / actual columns). Currency comes first so
// callers can curry it via a single local `format = (n) => formatAmount(code, n)`
// if they want to.
export function formatAmount(code: string, n: number): string {
  return `${symbolFor(code)}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format a signed amount in the user's currency. Used by variance cells.
//   0  → "$0.00"
//   +n → "+$1.23"
//   −n → "−$1.23"
export function formatSignedAmount(code: string, n: number): string {
  const sym = symbolFor(code);
  if (n === 0) return `${sym}0.00`;
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n > 0 ? `+${sym}${abs}` : `−${sym}${abs}`;
}

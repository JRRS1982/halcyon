// Describes a ledger query as the list of filters currently narrowing it, each
// with the URL patch that removes it. The drawer's badge count and the chip
// row both read from here, so the number can never disagree with the chips.
//
// Deliberately excludes the search box, which has a visible control of its own
// in the controls card: a chip for it would be a second representation of the
// same state, drifting from the first. "Uncategorized" *is* included, because
// it moved into the drawer — invisible state that hides rows is exactly what
// the chips exist to prevent.

import type { LedgerUrlQuery } from "./pagination";

export type ActiveFilter = {
  key: "uncategorized" | "date" | "account" | "category" | "amount";
  label: string;
  /** The searchParams patch that clears this filter. */
  clear: Record<string, null>;
};

export type FilterLookup = {
  accounts: { id: string; name: string }[];
  categories: { id: string; label: string }[];
};

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
// chip label that shifts between machines is a test that fails somewhere else.
function humanDate(isoDate: string, withYear = true): string {
  const [year = "", month = "", day = ""] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${name}${withYear ? ` ${year}` : ""}`;
}

function dateLabel(from: string | null, to: string | null): string | null {
  if (from && to) {
    // The year is stated once when both ends share it: "1 Jan – 31 Mar 2026".
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${humanDate(from, !sameYear)} – ${humanDate(to)}`;
  }
  if (from) return `From ${humanDate(from)}`;
  if (to) return `Until ${humanDate(to)}`;
  return null;
}

// Two decimals to match the ledger's own amount cells, which render a bare
// toFixed(2) with no currency symbol.
const money = (n: number) => n.toFixed(2);

function amountLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `Amount ${money(min)}–${money(max)}`;
  if (min !== null) return `Amount ${money(min)}+`;
  if (max !== null) return `Amount up to ${money(max)}`;
  return null;
}

export function activeFilters(
  query: LedgerUrlQuery,
  lookup: FilterLookup,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];

  if (query.onlyUncategorized) {
    filters.push({
      key: "uncategorized",
      label: "Uncategorized",
      clear: { uncat: null },
    });
  }

  const date = dateLabel(query.from, query.to);
  if (date) {
    filters.push({ key: "date", label: date, clear: { from: null, to: null } });
  }

  if (query.accountId) {
    // A filter on a since-deleted account keeps its chip: an invisible filter
    // silently hiding rows is worse than an unhelpfully labelled one, and the
    // chip is the only way to clear it without hand-editing the URL.
    const account = lookup.accounts.find((a) => a.id === query.accountId);
    filters.push({
      key: "account",
      label: account?.name ?? "Unknown account",
      clear: { acct: null },
    });
  }

  // Bound to a local first: narrowing on query.category would not survive the
  // closure passed to find().
  const category = query.category;
  if (category.kind !== "any") {
    const label =
      category.kind === "transfers"
        ? "Transfers"
        : (lookup.categories.find((c) => c.id === category.categoryId)?.label ??
          "Unknown category");
    filters.push({ key: "category", label, clear: { cat: null } });
  }

  const amount = amountLabel(query.amountMin, query.amountMax);
  if (amount) {
    filters.push({
      key: "amount",
      label: amount,
      clear: { min: null, max: null },
    });
  }

  return filters;
}

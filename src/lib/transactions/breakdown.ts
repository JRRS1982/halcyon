// What a budget row's Actual is made of, as the popover on the sheet lists it.
//
// The figure is derived from the listed amounts by the same rules the sheet's
// Actual uses (netActual for a category row, accountActual for an account row),
// so the list and the figure beside it cannot disagree.

import { monthRangeFor } from "@/lib/budget/period";
import {
  accountActual,
  type ItemType,
  isAccountKeyed,
  netActual,
} from "./actual";
import { countedParam } from "./pagination";

export type BreakdownKind = {
  type: ItemType;
  direction: "INFLOW" | "OUTFLOW" | null;
};

/**
 * The row's Actual from the amounts its breakdown lists: stored signs for a
 * category row, signs seen from the account for an account row.
 */
export function breakdownActual(
  kind: BreakdownKind,
  amounts: number[],
): number {
  if (!isAccountKeyed(kind.type)) return netActual(amounts, kind.type);
  const net = amounts.reduce((sum, amount) => sum + amount, 0);
  return accountActual(net, kind.type, kind.direction);
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * The ledger showing exactly the rows a budget row's Actual is made of, for a
 * month (0-indexed): a category row by the drawer's own filters, an account
 * row by `counted`. Null for a row with nothing to key on.
 */
export function breakdownLedgerHref(
  item: BreakdownKind & { categoryId: string | null; accountId: string | null },
  year: number,
  month: number,
): string | null {
  if (isAccountKeyed(item.type)) {
    if (!item.accountId) return null;
    const params = new URLSearchParams({
      counted: countedParam(item.accountId, year, month),
    });
    return `/transactions?${params}`;
  }
  if (!item.categoryId) return null;
  const { startDate, endDate } = monthRangeFor(year, month);
  const params = new URLSearchParams({
    cat: item.categoryId,
    from: isoDay(startDate),
    to: isoDay(endDate),
  });
  return `/transactions?${params}`;
}

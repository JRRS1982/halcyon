// What a budget row's Actual is made of, as the popover on the sheet lists it.
//
// The figure is derived from the listed amounts by the same rules the sheet's
// Actual uses (netActual for a category row, accountActual for an account row),
// so the list and the figure beside it cannot disagree.

import {
  accountActual,
  type ItemType,
  isAccountKeyed,
  netActual,
} from "./actual";

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

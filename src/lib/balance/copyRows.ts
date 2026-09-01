import type { Prisma } from "@prisma/client";

// The shape of a BalanceItem row that copy-forward carries into a target
// period. A BalanceItem is nothing but a per-month observation of an
// account — value and notes — so only the account and its value travel.
// Notes describe the source month's figure, not the target's, so they don't
// carry over either.
type SourceBalanceRow = {
  accountId: string;
  value: Prisma.Decimal;
};

export type CopiedBalanceRow = {
  accountId: string;
  value: number;
  carriedOver: true;
};

// Turns a source period's rows into fresh values for a target period:
// `carriedOver: true` because the value is last month's number, not one the
// user has confirmed for the target month yet. The row's id is the action's
// job — it has the live account to hand, this doesn't.
export function toCarriedOverRows(
  items: SourceBalanceRow[],
): CopiedBalanceRow[] {
  return items.map((it) => ({
    accountId: it.accountId,
    value: Number(it.value),
    carriedOver: true,
  }));
}

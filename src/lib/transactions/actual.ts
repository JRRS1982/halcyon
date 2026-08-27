// Turns a category's signed transaction amounts into its budget `actual`.
//
// Amounts are stored signed; the category's *type* routes the side, not the
// sign. Spend reads positive on EXPENSE rows, receipts read positive on INCOME
// rows, so refunds (a credit on an expense) and clawbacks (a debit on income)
// net correctly. Rounded to cents to avoid float drift on the sum.

// Mirrors the full Prisma ItemType enum (INCOME/EXPENSE/TRANSFER/REPAYMENT):
// a BudgetItem's type can be any of the four, but only the two category-keyed
// kinds have an actual this function can compute.
export type ItemType = "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";

// TRANSFER/REPAYMENT rows key on an account, not a category, so their actual
// comes from netTransfersForAccounts (see ./transfers). Excluded here by kind
// rather than by relying on such rows happening to carry no categoryId — an
// accident is not a boundary. Exported so a call site with both sources to
// hand routes on the same rule rather than on whether an id happens to be set.
export const isAccountKeyed = (type: ItemType): boolean =>
  type === "TRANSFER" || type === "REPAYMENT";

const roundToCents = (n: number): number => {
  const rounded = Math.round(n * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};

export function netActual(amounts: number[], type: ItemType): number {
  if (isAccountKeyed(type)) return 0;

  const sum = amounts.reduce((total, amount) => total + amount, 0);
  return roundToCents(type === "EXPENSE" ? -sum : sum);
}

// The account-keyed mirror of netActual: turns one account's net transfer flow
// for the period (from getTransferFlowByAccount, signed relative to that
// account) into the row's `actual`.
//
// A TRANSFER INFLOW and a REPAYMENT both mean money arriving at the named
// account, which is the sign the account already reports, so they read it
// as-is. An OUTFLOW means money coming back out — negative from the account's
// side, positive as a thing the row budgeted — so it flips.
//
// Never clamped: budgeting an inflow and seeing money leave is a real reading,
// and hiding it behind a zero would make the variance agree with a plan that
// did not happen.
export function accountActual(
  net: number,
  type: ItemType,
  direction: "INFLOW" | "OUTFLOW" | null,
): number {
  if (!isAccountKeyed(type)) return 0;
  return roundToCents(direction === "OUTFLOW" ? -net : net);
}

export type DatedCategoryAmount = {
  categoryId: string;
  amount: number;
  date: Date;
};

// Key for one category's amounts within one calendar month. Both transaction
// dates and period start dates resolve to the same key via the UTC month.
export function monthCategoryKey(date: Date, categoryId: string): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}:${categoryId}`;
}

// Buckets signed transaction amounts by (UTC month, category), so a multi-month
// window can be overlaid onto budget rows with one query — each period's item
// looks up monthCategoryKey(period.startDate, item.categoryId) and feeds the
// amounts to netActual.
export function amountsByMonthAndCategory(
  txns: DatedCategoryAmount[],
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const tx of txns) {
    const key = monthCategoryKey(tx.date, tx.categoryId);
    const arr = grouped.get(key) ?? [];
    arr.push(tx.amount);
    grouped.set(key, arr);
  }
  return grouped;
}

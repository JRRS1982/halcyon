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
// accident is not a boundary.
const isAccountKeyed = (type: ItemType): boolean =>
  type === "TRANSFER" || type === "REPAYMENT";

export function netActual(amounts: number[], type: ItemType): number {
  if (isAccountKeyed(type)) return 0;

  const sum = amounts.reduce((total, amount) => total + amount, 0);
  const oriented = type === "EXPENSE" ? -sum : sum;
  const rounded = Math.round(oriented * 100) / 100;
  return rounded === 0 ? 0 : rounded;
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

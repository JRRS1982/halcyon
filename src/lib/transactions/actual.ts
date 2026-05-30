// Turns a category's signed transaction amounts into its budget `actual`.
//
// Amounts are stored signed; the category's *type* routes the side, not the
// sign. Spend reads positive on EXPENSE rows, receipts read positive on INCOME
// rows, so refunds (a credit on an expense) and clawbacks (a debit on income)
// net correctly. Rounded to cents to avoid float drift on the sum.

export type ItemType = "INCOME" | "EXPENSE";

export function netActual(amounts: number[], type: ItemType): number {
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  const oriented = type === "EXPENSE" ? -sum : sum;
  const rounded = Math.round(oriented * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

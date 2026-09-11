// The ledger's footer figure: the net of the rows actually rendered.
//
// Deliberately the *page*, not every matching row. A filtered group usually
// fits on one page, where the two are the same number — and when it does not,
// the label says which it is rather than letting a partial sum read as a
// grand total.

export type LedgerFooter = {
  net: number;
  label: string;
};

// Money summed in pence. Adding 0.1 + 0.2 in floating point gives
// 0.30000000000000004, which reaches the screen as a total nobody typed;
// amounts carry two decimals (Decimal(14,2)), so integers are exact.
const netOf = (rows: { amount: number }[]): number =>
  rows.reduce((pence, row) => pence + Math.round(row.amount * 100), 0) / 100;

export function ledgerFooter(
  rows: { amount: number }[],
  matchingTotal: number,
): LedgerFooter {
  const shown = rows.length;
  const label =
    shown < matchingTotal
      ? `This page · ${shown} of ${matchingTotal}`
      : `Total · ${shown} transaction${shown === 1 ? "" : "s"}`;

  return { net: netOf(rows), label };
}

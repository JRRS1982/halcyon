/**
 * The monthly-loop checklist shown at the top of the dashboard.
 *
 * The habit the app asks for — enter the month, check the budget, update the
 * balances — lives in the guide and the reminder email as prose, but nothing
 * in the product showed where you were in it. This derives that state from
 * data the dashboard already loads; it stores nothing.
 */

export type ChecklistInput = {
  transactionsEnabled: boolean;
  /** The current calendar month's period has at least one budget row. */
  hasBudgetItems: boolean;
  /** The current calendar month's period has at least one balance row. */
  hasBalanceItems: boolean;
  /** Transactions with no category and no transfer, across all months. */
  uncategorizedCount: number;
};

export type ChecklistItem = {
  key: "categorise" | "budget" | "balance";
  label: string;
  done: boolean;
  href: "/transactions" | "/budget" | "/balance";
};

export type Checklist = {
  items: ChecklistItem[];
  complete: boolean;
};

export function monthChecklist({
  transactionsEnabled,
  hasBudgetItems,
  hasBalanceItems,
  uncategorizedCount,
}: ChecklistInput): Checklist {
  const items: ChecklistItem[] = [];

  if (transactionsEnabled) {
    items.push(
      uncategorizedCount === 0
        ? {
            key: "categorise",
            label: "No transactions waiting to be categorised",
            done: true,
            href: "/transactions",
          }
        : {
            key: "categorise",
            label: `${uncategorizedCount} transaction${
              uncategorizedCount === 1 ? "" : "s"
            } to categorise`,
            done: false,
            href: "/transactions",
          },
    );
  }

  items.push(
    hasBudgetItems
      ? {
          key: "budget",
          label: "Budget sheet in place",
          done: true,
          href: "/budget",
        }
      : {
          key: "budget",
          label: "Start this month's budget",
          done: false,
          href: "/budget",
        },
    hasBalanceItems
      ? {
          key: "balance",
          label: "Balances recorded",
          done: true,
          href: "/balance",
        }
      : {
          key: "balance",
          label: "Update your balances",
          done: false,
          href: "/balance",
        },
  );

  return { items, complete: items.every((item) => item.done) };
}

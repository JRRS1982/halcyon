// src/__tests__/dashboard/checklist.test.ts
import { monthChecklist } from "@/lib/dashboard/checklist";

const base = {
  transactionsEnabled: true,
  hasBudgetItems: true,
  hasBalanceItems: true,
  uncategorizedCount: 0,
};

describe("monthChecklist", () => {
  test("all done when every stage has data", () => {
    const { items, complete } = monthChecklist(base);
    expect(complete).toBe(true);
    expect(items.every((item) => item.done)).toBe(true);
  });

  test("transactions mode shows categorise, budget and balance stages in loop order", () => {
    const { items } = monthChecklist(base);
    expect(items.map((item) => item.key)).toEqual([
      "categorise",
      "budget",
      "balance",
    ]);
  });

  test("manual mode drops the categorise stage", () => {
    const { items } = monthChecklist({ ...base, transactionsEnabled: false });
    expect(items.map((item) => item.key)).toEqual(["budget", "balance"]);
  });

  test("uncategorized transactions surface as a count with a link to the ledger", () => {
    const { items, complete } = monthChecklist({
      ...base,
      uncategorizedCount: 12,
    });
    const categorise = items.find((item) => item.key === "categorise");
    expect(complete).toBe(false);
    expect(categorise?.done).toBe(false);
    expect(categorise?.label).toMatch(/12 transactions to categorise/i);
    expect(categorise?.href).toBe("/transactions");
  });

  test("a single uncategorized transaction reads singular", () => {
    const { items } = monthChecklist({ ...base, uncategorizedCount: 1 });
    const categorise = items.find((item) => item.key === "categorise");
    expect(categorise?.label).toMatch(/1 transaction to categorise/i);
  });

  test("a month with no budget rows points at the budget sheet", () => {
    const { items, complete } = monthChecklist({
      ...base,
      hasBudgetItems: false,
    });
    const budget = items.find((item) => item.key === "budget");
    expect(complete).toBe(false);
    expect(budget?.done).toBe(false);
    expect(budget?.href).toBe("/budget");
  });

  test("a month with no balance rows points at the balance sheet", () => {
    const { items } = monthChecklist({ ...base, hasBalanceItems: false });
    const balance = items.find((item) => item.key === "balance");
    expect(balance?.done).toBe(false);
    expect(balance?.href).toBe("/balance");
  });
});

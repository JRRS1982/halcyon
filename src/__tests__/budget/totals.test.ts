import {
  computeRollups,
  grandTotals,
  type ItemForTotals,
  sectionTotals,
} from "@/lib/budget/totals";

const item = (
  id: string,
  type: "INCOME" | "EXPENSE",
  parentItemId: string | null,
  budget: number,
  actual: number,
): ItemForTotals => ({ id, type, parentItemId, budget, actual });

describe("computeRollups", () => {
  test("leaf items return their own (budget, actual)", () => {
    const rollups = computeRollups([
      item("a", "INCOME", null, 100, 90),
      item("b", "INCOME", null, 200, 250),
    ]);
    expect(rollups.get("a")).toEqual({ budget: 100, actual: 90 });
    expect(rollups.get("b")).toEqual({ budget: 200, actual: 250 });
  });

  test("parent rolls up its children's amounts (parent's own values ignored)", () => {
    const rollups = computeRollups([
      item("salary", "INCOME", null, 999, 999), // ignored — has children
      item("his", "INCOME", "salary", 3000, 3000),
      item("hers", "INCOME", "salary", 2000, 2000),
    ]);
    expect(rollups.get("salary")).toEqual({ budget: 5000, actual: 5000 });
    expect(rollups.get("his")).toEqual({ budget: 3000, actual: 3000 });
    expect(rollups.get("hers")).toEqual({ budget: 2000, actual: 2000 });
  });

  test("nested grandchildren roll up to the top level", () => {
    const rollups = computeRollups([
      item("root", "EXPENSE", null, 0, 0),
      item("mid", "EXPENSE", "root", 0, 0),
      item("leaf1", "EXPENSE", "mid", 100, 80),
      item("leaf2", "EXPENSE", "mid", 50, 60),
    ]);
    expect(rollups.get("leaf1")).toEqual({ budget: 100, actual: 80 });
    expect(rollups.get("leaf2")).toEqual({ budget: 50, actual: 60 });
    expect(rollups.get("mid")).toEqual({ budget: 150, actual: 140 });
    expect(rollups.get("root")).toEqual({ budget: 150, actual: 140 });
  });

  test("empty input returns an empty map", () => {
    expect(computeRollups([])).toEqual(new Map());
  });
});

describe("sectionTotals", () => {
  test("aggregates only top-level items of the given type", () => {
    const items = [
      item("salary", "INCOME", null, 8500, 7500),
      item("freelance", "INCOME", null, 1000, 0),
      item("housing", "EXPENSE", null, 2200, 2200),
    ];
    const rollups = computeRollups(items);
    const income = sectionTotals(items, "INCOME", rollups);
    expect(income.budget).toBe(9500);
    expect(income.actual).toBe(7500);
  });

  test("INCOME variance = actual - budget (positive = surplus)", () => {
    const items = [item("salary", "INCOME", null, 8000, 8500)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "INCOME", rollups);
    expect(totals.variance).toBe(500);
  });

  test("EXPENSE variance = budget - actual (positive = under budget)", () => {
    const items = [item("housing", "EXPENSE", null, 2200, 2000)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "EXPENSE", rollups);
    expect(totals.variance).toBe(200);
  });

  test("variancePct = 0 when budget is 0 (no divide-by-zero)", () => {
    const items = [item("x", "INCOME", null, 0, 100)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "INCOME", rollups);
    expect(totals.variancePct).toBe(0);
  });

  test("variancePct rounds to whole number", () => {
    const items = [item("x", "EXPENSE", null, 300, 100)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "EXPENSE", rollups);
    expect(totals.variancePct).toBe(33); // 100/300 ≈ 33.33 → 33
  });

  test("does NOT double-count children when computing section totals", () => {
    // Parent + 2 children both with type INCOME. Parent shows the rolled-up
    // amount; children also appear in the items list. The section total
    // should reflect the parent's roll-up ONLY (top-level), not the children
    // additionally.
    const items = [
      item("salary", "INCOME", null, 0, 0),
      item("his", "INCOME", "salary", 3000, 3000),
      item("hers", "INCOME", "salary", 2000, 2000),
    ];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "INCOME", rollups);
    expect(totals.budget).toBe(5000); // not 10000
    expect(totals.actual).toBe(5000);
  });
});

describe("grandTotals", () => {
  test("net = income - expenses", () => {
    const items = [
      item("salary", "INCOME", null, 8500, 7500),
      item("housing", "EXPENSE", null, 6400, 4280),
    ];
    const rollups = computeRollups(items);
    const income = sectionTotals(items, "INCOME", rollups);
    const expenses = sectionTotals(items, "EXPENSE", rollups);
    const grand = grandTotals(income, expenses);
    expect(grand.budget).toBe(2100); // 8500 - 6400
    expect(grand.actual).toBe(3220); // 7500 - 4280
    expect(grand.variance).toBe(1120); // 3220 - 2100
  });

  test("zero income + zero expenses → all zeros", () => {
    const empty = { budget: 0, actual: 0, variance: 0, variancePct: 0 };
    const grand = grandTotals(empty, empty);
    expect(grand).toEqual({ budget: 0, actual: 0, variance: 0 });
  });
});

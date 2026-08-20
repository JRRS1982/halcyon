import {
  computeRollups,
  grandTotals,
  type ItemForTotals,
  sectionTotals,
} from "@/lib/budget/totals";

const item = (
  id: string,
  type: "INCOME" | "EXPENSE",
  budget: number,
  actual: number,
): ItemForTotals => ({ id, type, budget, actual });

describe("computeRollups", () => {
  test("each item returns its own (budget, actual)", () => {
    const rollups = computeRollups([
      item("a", "INCOME", 100, 90),
      item("b", "INCOME", 200, 250),
    ]);
    expect(rollups.get("a")).toEqual({ budget: 100, actual: 90 });
    expect(rollups.get("b")).toEqual({ budget: 200, actual: 250 });
  });

  test("empty input returns an empty map", () => {
    expect(computeRollups([])).toEqual(new Map());
  });
});

describe("sectionTotals", () => {
  test("aggregates every item of the given type", () => {
    const items = [
      item("salary", "INCOME", 8500, 7500),
      item("freelance", "INCOME", 1000, 0),
      item("housing", "EXPENSE", 2200, 2200),
    ];
    const rollups = computeRollups(items);
    const income = sectionTotals(items, "INCOME", rollups);
    expect(income.budget).toBe(9500);
    expect(income.actual).toBe(7500);
  });

  test("INCOME variance = actual - budget (positive = surplus)", () => {
    const items = [item("salary", "INCOME", 8000, 8500)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "INCOME", rollups);
    expect(totals.variance).toBe(500);
  });

  test("EXPENSE variance = budget - actual (positive = under budget)", () => {
    const items = [item("housing", "EXPENSE", 2200, 2000)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "EXPENSE", rollups);
    expect(totals.variance).toBe(200);
  });

  test("variancePct = 0 when budget is 0 (no divide-by-zero)", () => {
    const items = [item("x", "INCOME", 0, 100)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "INCOME", rollups);
    expect(totals.variancePct).toBe(0);
  });

  test("variancePct rounds to whole number", () => {
    const items = [item("x", "EXPENSE", 300, 100)];
    const rollups = computeRollups(items);
    const totals = sectionTotals(items, "EXPENSE", rollups);
    expect(totals.variancePct).toBe(33); // 100/300 ≈ 33.33 → 33
  });
});

describe("grandTotals", () => {
  test("net = income - expenses", () => {
    const items = [
      item("salary", "INCOME", 8500, 7500),
      item("housing", "EXPENSE", 6400, 4280),
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

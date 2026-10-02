import {
  computeRollups,
  favourableVariance,
  type ItemForTotals,
  sumAmounts,
  surplus,
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

describe("sumAmounts", () => {
  test("adds up the (budget, actual) of exactly the rows it is given", () => {
    const items = [
      item("salary", "INCOME", 8500, 7500),
      item("freelance", "INCOME", 1000, 0),
      item("housing", "EXPENSE", 2200, 2200),
    ];
    const rollups = computeRollups(items);
    expect(sumAmounts(items.slice(0, 2), rollups)).toEqual({
      budget: 9500,
      actual: 7500,
    });
  });

  // The Expenses section total includes repayments — the whole reason they
  // render there. Summing a caller-chosen set is what makes that possible
  // without the totals module knowing about sections.
  test("a mixed set sums whatever is in it, repayments included", () => {
    const items: ItemForTotals[] = [
      item("housing", "EXPENSE", 2200, 2200),
      { id: "mortgage", type: "REPAYMENT", budget: 1250, actual: 1250 },
    ];
    const rollups = computeRollups(items);
    expect(sumAmounts(items, rollups)).toEqual({ budget: 3450, actual: 3450 });
  });

  test("a row with no rollup contributes nothing", () => {
    const items = [item("salary", "INCOME", 8500, 7500)];
    const rollups = computeRollups(items);
    expect(
      sumAmounts([...items, item("ghost", "INCOME", 99, 99)], rollups),
    ).toEqual({ budget: 8500, actual: 7500 });
  });

  test("an empty set sums to zero", () => {
    expect(sumAmounts([], computeRollups([]))).toEqual({
      budget: 0,
      actual: 0,
    });
  });
});

describe("favourableVariance", () => {
  test("earning more than budgeted is favourable", () => {
    expect(
      favourableVariance(
        { type: "INCOME", direction: null },
        { budget: 3000, actual: 3200 },
      ),
    ).toBe(200);
  });

  test("spending less than budgeted is favourable", () => {
    expect(
      favourableVariance(
        { type: "EXPENSE", direction: null },
        { budget: 1000, actual: 800 },
      ),
    ).toBe(200);
  });

  test("spending more than budgeted is unfavourable", () => {
    expect(
      favourableVariance(
        { type: "EXPENSE", direction: null },
        { budget: 1000, actual: 1200 },
      ),
    ).toBe(-200);
  });

  test("paying down more than budgeted is favourable", () => {
    expect(
      favourableVariance(
        { type: "REPAYMENT", direction: null },
        { budget: 1000, actual: 1200 },
      ),
    ).toBe(200);
  });

  test("paying down less than budgeted is unfavourable", () => {
    expect(
      favourableVariance(
        { type: "REPAYMENT", direction: null },
        { budget: 1000, actual: 800 },
      ),
    ).toBe(-200);
  });

  test("saving more than budgeted (TRANSFER INFLOW) is favourable", () => {
    expect(
      favourableVariance(
        { type: "TRANSFER", direction: "INFLOW" },
        { budget: 200, actual: 300 },
      ),
    ).toBe(100);
  });

  test("saving less than budgeted (TRANSFER INFLOW) is unfavourable", () => {
    expect(
      favourableVariance(
        { type: "TRANSFER", direction: "INFLOW" },
        { budget: 200, actual: 100 },
      ),
    ).toBe(-100);
  });

  test("raiding savings less than budgeted (TRANSFER OUTFLOW) is favourable", () => {
    expect(
      favourableVariance(
        { type: "TRANSFER", direction: "OUTFLOW" },
        { budget: 200, actual: 150 },
      ),
    ).toBe(50);
  });

  test("raiding savings more than budgeted (TRANSFER OUTFLOW) is unfavourable", () => {
    expect(
      favourableVariance(
        { type: "TRANSFER", direction: "OUTFLOW" },
        { budget: 200, actual: 250 },
      ),
    ).toBe(-50);
  });

  // Guards against the two TRANSFER directions being swapped: identical
  // (budget, actual) pairs must yield opposite-signed results depending on
  // direction alone.
  test("the same over-budget amount flips sign between INFLOW and OUTFLOW", () => {
    const amounts = { budget: 200, actual: 300 };
    const inflow = favourableVariance(
      { type: "TRANSFER", direction: "INFLOW" },
      amounts,
    );
    const outflow = favourableVariance(
      { type: "TRANSFER", direction: "OUTFLOW" },
      amounts,
    );
    expect(inflow).toBe(100);
    expect(outflow).toBe(-100);
  });
});

describe("surplus", () => {
  test("surplus counts repayments as spending and transfers by direction", () => {
    const items: ItemForTotals[] = [
      { id: "a", type: "INCOME", direction: null, budget: 3000, actual: 3000 },
      { id: "b", type: "EXPENSE", direction: null, budget: 1000, actual: 1000 },
      { id: "c", type: "REPAYMENT", direction: null, budget: 500, actual: 500 },
      {
        id: "d",
        type: "TRANSFER",
        direction: "INFLOW",
        budget: 200,
        actual: 200,
      },
    ];
    // 3000 − 1000 − 500 − 200
    expect(surplus(items, "actual")).toBe(1300);
  });

  test("a transfer OUTFLOW adds back to surplus instead of subtracting", () => {
    const items: ItemForTotals[] = [
      { id: "a", type: "INCOME", direction: null, budget: 5000, actual: 5000 },
      { id: "b", type: "EXPENSE", direction: null, budget: 1000, actual: 1000 },
      { id: "c", type: "REPAYMENT", direction: null, budget: 300, actual: 300 },
      {
        id: "d",
        type: "TRANSFER",
        direction: "INFLOW",
        budget: 200,
        actual: 200,
      },
      {
        id: "e",
        type: "TRANSFER",
        direction: "OUTFLOW",
        budget: 150,
        actual: 150,
      },
    ];
    // 5000 − 1000 − 300 − 200 (inflow) + 150 (outflow)
    expect(surplus(items, "actual")).toBe(3650);
  });

  // Guards against the two TRANSFER directions being swapped in surplus: an
  // OUTFLOW-only list must land on the opposite side of income-minus-expenses
  // from an otherwise-identical INFLOW-only list.
  test("swapping a transfer's direction changes surplus by twice its amount", () => {
    const base: ItemForTotals[] = [
      { id: "a", type: "INCOME", direction: null, budget: 1000, actual: 1000 },
      { id: "b", type: "EXPENSE", direction: null, budget: 400, actual: 400 },
    ];
    const withInflow = [
      ...base,
      {
        id: "t",
        type: "TRANSFER" as const,
        direction: "INFLOW" as const,
        budget: 100,
        actual: 100,
      },
    ];
    const withOutflow = [
      ...base,
      {
        id: "t",
        type: "TRANSFER" as const,
        direction: "OUTFLOW" as const,
        budget: 100,
        actual: 100,
      },
    ];
    expect(surplus(withInflow, "actual")).toBe(500); // 1000 - 400 - 100
    expect(surplus(withOutflow, "actual")).toBe(700); // 1000 - 400 + 100
  });

  test("surplus can be computed over budgeted amounts instead of actuals", () => {
    const items: ItemForTotals[] = [
      { id: "a", type: "INCOME", direction: null, budget: 3000, actual: 9999 },
      { id: "b", type: "EXPENSE", direction: null, budget: 1000, actual: 1 },
      {
        id: "c",
        type: "TRANSFER",
        direction: "OUTFLOW",
        budget: 100,
        actual: 1,
      },
    ];
    // 3000 − 1000 + 100, ignoring the actual columns entirely
    expect(surplus(items, "budget")).toBe(2100);
  });

  test("empty item list has zero surplus", () => {
    expect(surplus([], "actual")).toBe(0);
  });
});

import {
  amountsByMonthAndCategory,
  monthCategoryKey,
  netActual,
} from "@/lib/transactions/actual";

describe("netActual", () => {
  test("expense spend (negative amounts) reads as positive spend", () => {
    // -250 -150 +10 (refund) → net spend 390
    expect(netActual([-250, -150, 10], "EXPENSE")).toBe(390);
  });

  test("income receipts (positive amounts) sum, clawbacks subtract", () => {
    // salary 2000, clawback -100 → 1900
    expect(netActual([2000, -100], "INCOME")).toBe(1900);
  });

  test("an expense whose refunds exceed spend goes negative", () => {
    expect(netActual([-50, 80], "EXPENSE")).toBe(-30);
  });

  test("no transactions net to zero", () => {
    expect(netActual([], "EXPENSE")).toBe(0);
    expect(netActual([], "INCOME")).toBe(0);
  });

  test("sums are rounded to cents (no float drift)", () => {
    expect(netActual([-0.1, -0.2], "EXPENSE")).toBe(0.3);
  });

  test("account-keyed kinds never take a category-keyed actual", () => {
    // TRANSFER/REPAYMENT rows key on an account, not a category: their actual
    // comes from netTransfersForAccounts. Excluded explicitly here rather than
    // by relying on such rows happening to carry no categoryId.
    expect(netActual([500, -200], "TRANSFER")).toBe(0);
    expect(netActual([-500, 200], "REPAYMENT")).toBe(0);
  });
});

describe("amountsByMonthAndCategory", () => {
  const d = (iso: string) => new Date(iso);

  test("groups amounts under a month + category key", () => {
    const grouped = amountsByMonthAndCategory([
      { categoryId: "food", amount: -50, date: d("2026-03-14T00:00:00Z") },
      { categoryId: "food", amount: -20, date: d("2026-03-20T00:00:00Z") },
      { categoryId: "food", amount: -99, date: d("2026-04-01T00:00:00Z") },
      { categoryId: "fuel", amount: -30, date: d("2026-03-14T00:00:00Z") },
    ]);
    expect(
      grouped.get(monthCategoryKey(d("2026-03-01T00:00:00Z"), "food")),
    ).toEqual([-50, -20]);
    expect(
      grouped.get(monthCategoryKey(d("2026-04-01T00:00:00Z"), "food")),
    ).toEqual([-99]);
    expect(
      grouped.get(monthCategoryKey(d("2026-03-01T00:00:00Z"), "fuel")),
    ).toEqual([-30]);
  });

  test("keys by UTC month, so a month-end timestamp stays in its month", () => {
    const grouped = amountsByMonthAndCategory([
      { categoryId: "food", amount: -1, date: d("2026-03-31T23:59:59Z") },
    ]);
    expect(
      grouped.get(monthCategoryKey(d("2026-03-01T00:00:00Z"), "food")),
    ).toEqual([-1]);
  });
});

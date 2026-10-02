import {
  accountActual,
  amountsByMonthAndCategory,
  isAccountKeyed,
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

describe("isAccountKeyed", () => {
  test("names the two kinds whose actual comes from an account", () => {
    expect(isAccountKeyed("TRANSFER")).toBe(true);
    expect(isAccountKeyed("REPAYMENT")).toBe(true);
    expect(isAccountKeyed("INCOME")).toBe(false);
    expect(isAccountKeyed("EXPENSE")).toBe(false);
  });
});

describe("accountActual", () => {
  // netTransfersForAccounts signs its net relative to the named account:
  // money into it is positive. An INFLOW row budgets money going in, so the
  // account-relative sign is already the one the row means.
  test("a transfer INFLOW reads the account's net as-is", () => {
    expect(accountActual(500, "TRANSFER", "INFLOW")).toBe(500);
  });

  // OUTFLOW budgets money coming back out, which the account sees as negative.
  // The row's actual is what moved, so the sign flips.
  test("a transfer OUTFLOW flips the account's sign", () => {
    expect(accountActual(-500, "TRANSFER", "OUTFLOW")).toBe(500);
  });

  test("the two directions are not interchangeable", () => {
    expect(accountActual(500, "TRANSFER", "INFLOW")).toBe(
      -accountActual(500, "TRANSFER", "OUTFLOW"),
    );
  });

  // Money at a debt lands in the liability account, which reads positive from
  // that account's side. A repayment carries no direction at all.
  test("a repayment reads the debt account's net as-is", () => {
    expect(accountActual(1250, "REPAYMENT", null)).toBe(1250);
  });

  // Budgeting an inflow and seeing money leave is a real reading, not a
  // rounding error — it must survive rather than be clamped to zero.
  test("a movement that went the other way reads negative", () => {
    expect(accountActual(-200, "TRANSFER", "INFLOW")).toBe(-200);
  });

  test("category-keyed kinds have no account actual", () => {
    expect(accountActual(500, "INCOME", null)).toBe(0);
    expect(accountActual(500, "EXPENSE", null)).toBe(0);
  });

  test("rounds to cents and normalises -0", () => {
    expect(accountActual(0.1 + 0.2, "TRANSFER", "INFLOW")).toBe(0.3);
    expect(Object.is(accountActual(0, "TRANSFER", "OUTFLOW"), 0)).toBe(true);
  });
});

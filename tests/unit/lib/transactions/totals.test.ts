import { ledgerFooter } from "@/lib/transactions/totals";

const rows = (...amounts: number[]) => amounts.map((amount) => ({ amount }));

describe("ledgerFooter", () => {
  test("nets the rendered rows, signs included", () => {
    expect(ledgerFooter(rows(-40, -5.5, 200), 3).net).toBe(154.5);
  });

  test("a single-sign page nets to that sign", () => {
    expect(ledgerFooter(rows(-40, -5.5), 2).net).toBe(-45.5);
  });

  test("decimal amounts do not accumulate float noise", () => {
    // 0.1 + 0.2 is the classic case; a money total must not read 0.30000000000000004.
    expect(ledgerFooter(rows(0.1, 0.2), 2).net).toBe(0.3);
  });

  test("an empty page nets to zero rather than NaN", () => {
    expect(ledgerFooter([], 0).net).toBe(0);
  });

  test("when everything matching fits on one page, the total is the whole total", () => {
    expect(ledgerFooter(rows(-40, -5), 2).label).toBe("Total · 2 transactions");
  });

  test("a single matching row is not pluralised", () => {
    expect(ledgerFooter(rows(-40), 1).label).toBe("Total · 1 transaction");
  });

  test("when matches spill past this page, the label says so", () => {
    // Calling this "Total" would be a lie by omission — it covers 50 of 312.
    expect(ledgerFooter(rows(...new Array(50).fill(-1)), 312).label).toBe(
      "This page · 50 of 312",
    );
  });

  test("the last page of many still says which page it is", () => {
    expect(ledgerFooter(rows(-1, -2), 52).label).toBe("This page · 2 of 52");
  });
});

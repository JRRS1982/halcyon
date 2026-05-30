import { netActual } from "@/lib/transactions/actual";

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
});

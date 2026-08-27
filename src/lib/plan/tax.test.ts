// src/lib/plan/tax.test.ts
import { isTaxableOnWithdrawal } from "./tax";

describe("isTaxableOnWithdrawal", () => {
  it("PENSION and GIA are taxed on withdrawal; ISA/CASH are not", () => {
    expect(isTaxableOnWithdrawal("PENSION")).toBe(true);
    expect(isTaxableOnWithdrawal("GIA")).toBe(true);
    expect(isTaxableOnWithdrawal("ISA")).toBe(false);
    expect(isTaxableOnWithdrawal("CASH")).toBe(false);
  });
});

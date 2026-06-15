// src/lib/plan/tax.test.ts
import { grossUp, incomeTax, isTaxableOnWithdrawal } from "./tax";

describe("incomeTax", () => {
  it("applies the blended rate to taxable income", () => {
    expect(incomeTax(50000, 20)).toBe(10000);
    expect(incomeTax(0, 40)).toBe(0);
  });
});

describe("isTaxableOnWithdrawal", () => {
  it("PENSION and GIA are taxed on withdrawal; ISA/CASH are not", () => {
    expect(isTaxableOnWithdrawal("PENSION")).toBe(true);
    expect(isTaxableOnWithdrawal("GIA")).toBe(true);
    expect(isTaxableOnWithdrawal("ISA")).toBe(false);
    expect(isTaxableOnWithdrawal("CASH")).toBe(false);
  });
});

describe("grossUp", () => {
  it("grosses up a net need so the withdrawal covers its own tax", () => {
    expect(grossUp(8000, 20)).toEqual({ gross: 10000, tax: 2000 });
  });
  it("is a no-op at 0%", () => {
    expect(grossUp(8000, 0)).toEqual({ gross: 8000, tax: 0 });
  });
});

import { isValidBalanceCategory } from "@/lib/balance/reorder";

describe("isValidBalanceCategory", () => {
  test("PROPERTY is valid for an asset", () => {
    expect(isValidBalanceCategory("ASSET", "PROPERTY")).toBe(true);
  });

  test("PROPERTY is invalid for a liability — mortgage debt files under Long-term instead", () => {
    expect(isValidBalanceCategory("LIABILITY", "PROPERTY")).toBe(false);
  });

  test("every other category is valid for either type", () => {
    for (const type of ["ASSET", "LIABILITY"] as const) {
      for (const category of [
        "CURRENT",
        "MEDIUM_TERM",
        "LONG_TERM",
        "OTHER",
      ] as const) {
        expect(isValidBalanceCategory(type, category)).toBe(true);
      }
    }
  });
});

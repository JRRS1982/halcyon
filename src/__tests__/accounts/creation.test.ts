// buildPrimaryAccountData was deleted in feat/balance-accounts (Task 2) —
// replaced by buildAccountData, which takes an AccountType rather than the
// old (kind, category, wrapper) triple. Its describe block, and the
// buildMortgageAccountData tests asserting the old category-shaped output,
// are gone with it. Current coverage for both builders lives in
// src/__tests__/accounts/derivation.test.ts; this file's remaining
// behaviour (nextSortOrder) is untouched by that rename. See Task 3's
// report for the ruling — this file's fuller rewrite belongs to Task 5/9.
import { nextSortOrder } from "@/lib/accounts/creation";

describe("nextSortOrder", () => {
  test("first row in an empty bucket sorts at 1", () => {
    expect(nextSortOrder(null)).toBe(1);
  });

  test("undefined behaves the same as no existing row", () => {
    expect(nextSortOrder(undefined)).toBe(1);
  });

  test("appends after the last row in the bucket", () => {
    expect(nextSortOrder(4)).toBe(5);
  });

  test("appends after a sortOrder of zero", () => {
    expect(nextSortOrder(0)).toBe(1);
  });
});

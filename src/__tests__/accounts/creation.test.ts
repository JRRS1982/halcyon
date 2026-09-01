// buildPrimaryAccountData was deleted in feat/balance-accounts (Task 2) —
// replaced by buildAccountData, which takes an AccountType rather than the
// old (kind, category, wrapper) triple. Its describe block, and the
// buildMortgageAccountData tests asserting the old category-shaped output,
// are gone with it. Current coverage for both builders lives in
// src/__tests__/accounts/derivation.test.ts.
//
// nextSortOrder's ruling (Task 3, contract PR): createAccount needs a brand
// new (kind, section) bucket's first account to be 0-based rather than
// skipping straight to 1, so a missing last row (null/undefined — never a
// real row, since sortOrder is a required Int) now sorts at 0. This file's
// fuller rewrite still belongs to Task 5/9.
import { nextSortOrder } from "@/lib/accounts/creation";

describe("nextSortOrder", () => {
  test("first row in an empty bucket sorts at 0", () => {
    expect(nextSortOrder(null)).toBe(0);
  });

  test("undefined behaves the same as no existing row", () => {
    expect(nextSortOrder(undefined)).toBe(0);
  });

  test("appends after the last row in the bucket", () => {
    expect(nextSortOrder(4)).toBe(5);
  });

  test("appends after a sortOrder of zero", () => {
    expect(nextSortOrder(0)).toBe(1);
  });
});

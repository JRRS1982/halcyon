import {
  buildMortgageAccountData,
  buildPrimaryAccountData,
  nextSortOrder,
} from "@/lib/accounts/creation";

const isaInput = {
  year: 2026,
  month: 2,
  name: "Vanguard ISA",
  type: "ASSET" as const,
  category: "LONG_TERM" as const,
  wrapper: "ISA" as const,
  value: 42300,
  canImportTransactions: false,
  mortgage: null,
};

describe("buildPrimaryAccountData", () => {
  test("an asset keeps its wrapper", () => {
    const data = buildPrimaryAccountData(isaInput);
    expect(data).toEqual({
      name: "Vanguard ISA",
      kind: "ASSET",
      category: "LONG_TERM",
      wrapper: "ISA",
      canImportTransactions: false,
    });
  });

  test("a liability's wrapper is dropped, even if one was supplied", () => {
    const data = buildPrimaryAccountData({
      ...isaInput,
      type: "LIABILITY",
      category: "OTHER",
      wrapper: "OTHER",
    });
    expect(data.wrapper).toBeNull();
  });

  test("normalises whitespace in the name", () => {
    const data = buildPrimaryAccountData({
      ...isaInput,
      name: "  Vanguard   ISA  ",
    });
    expect(data.name).toBe("Vanguard ISA");
  });
});

describe("buildMortgageAccountData", () => {
  const mortgage = {
    name: "Halifax mortgage",
    value: 184200,
    canImportTransactions: false,
  };

  test("always LONG_TERM LIABILITY with no wrapper, regardless of the property", () => {
    const data = buildMortgageAccountData(mortgage);
    expect(data).toEqual({
      name: "Halifax mortgage",
      kind: "LIABILITY",
      category: "LONG_TERM",
      wrapper: null,
      canImportTransactions: false,
    });
  });

  test("normalises whitespace in the mortgage name", () => {
    const data = buildMortgageAccountData({
      ...mortgage,
      name: "  Halifax   mortgage  ",
    });
    expect(data.name).toBe("Halifax mortgage");
  });

  test("carries canImportTransactions through unchanged", () => {
    const data = buildMortgageAccountData({
      ...mortgage,
      canImportTransactions: true,
    });
    expect(data.canImportTransactions).toBe(true);
  });
});

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

import {
  ACCOUNT_TYPES,
  accountTypesOfKind,
  defaultSectionOf,
  kindOf,
  wrapperOf,
} from "@/lib/accounts/accountDraft";
import {
  buildAccountData,
  buildMortgageAccountData,
} from "@/lib/accounts/creation";

describe("type derivations", () => {
  it("agrees with the ACCOUNT_TYPES table for all fourteen types", () => {
    for (const t of ACCOUNT_TYPES) {
      expect(kindOf(t.id)).toBe(t.kind);
      expect(wrapperOf(t.id)).toBe(t.wrapper);
      expect(defaultSectionOf(t.id)).toBe(t.defaultSection);
    }
    expect(ACCOUNT_TYPES).toHaveLength(14);
  });

  it("every liability derives a null wrapper", () => {
    for (const t of accountTypesOfKind("LIABILITY")) {
      expect(wrapperOf(t.id)).toBeNull();
    }
    expect(accountTypesOfKind("ASSET")).toHaveLength(9);
    expect(accountTypesOfKind("LIABILITY")).toHaveLength(5);
  });

  it("buildAccountData writes the type, the section, and both mirrors", () => {
    expect(buildAccountData({ type: "STOCKS_ISA" })).toEqual({
      type: "STOCKS_ISA",
      section: "LONG_TERM",
      kind: "ASSET",
      wrapper: "ISA",
    });
    expect(buildAccountData({ type: "CREDIT_CARD", section: "OTHER" })).toEqual(
      {
        type: "CREDIT_CARD",
        section: "OTHER",
        kind: "LIABILITY",
        wrapper: null,
      },
    );
  });

  it("buildMortgageAccountData includes type in its output", () => {
    const result = buildMortgageAccountData({
      name: "Test Mortgage",
      canImportTransactions: true,
    });
    expect(result).toHaveProperty("type", "MORTGAGE");
  });
});

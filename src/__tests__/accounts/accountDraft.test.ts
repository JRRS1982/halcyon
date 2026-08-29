import {
  ACCOUNT_TYPES,
  accountTypeById,
  canSubmitAccountDraft,
  defaultCanImportTransactions,
} from "@/lib/accounts/accountDraft";

describe("defaultCanImportTransactions", () => {
  test("an asset defaults on", () => {
    expect(defaultCanImportTransactions("ASSET", null)).toBe(true);
    expect(defaultCanImportTransactions("ASSET", "CASH")).toBe(true);
  });

  test("a liability defaults off, and carries no wrapper anyway", () => {
    expect(defaultCanImportTransactions("LIABILITY", null)).toBe(false);
    expect(defaultCanImportTransactions("LIABILITY", "CASH")).toBe(false);
  });

  test("a property asset defaults off — a property isn't a statement-import account", () => {
    expect(defaultCanImportTransactions("ASSET", "PROPERTY")).toBe(false);
  });
});

describe("canSubmitAccountDraft", () => {
  const base = {
    type: "ASSET" as const,
    category: "LONG_TERM" as const,
    name: "Vanguard ISA",
    value: "42300",
    hasMortgage: false,
    mortgageName: "",
    mortgageValue: "",
  };

  test("a complete draft is submittable", () => {
    expect(canSubmitAccountDraft(base)).toBe(true);
  });

  test("no type chosen yet blocks submission", () => {
    expect(canSubmitAccountDraft({ ...base, type: null })).toBe(false);
  });

  test("no section chosen blocks submission — nothing defaults into a section", () => {
    expect(canSubmitAccountDraft({ ...base, category: null })).toBe(false);
  });

  test("a blank name blocks submission", () => {
    expect(canSubmitAccountDraft({ ...base, name: "   " })).toBe(false);
  });

  test("a blank or non-numeric value blocks submission", () => {
    expect(canSubmitAccountDraft({ ...base, value: "" })).toBe(false);
    expect(canSubmitAccountDraft({ ...base, value: "not-a-number" })).toBe(
      false,
    );
  });

  test("a mortgage with no name or value blocks submission even though the primary fields are complete", () => {
    expect(canSubmitAccountDraft({ ...base, hasMortgage: true })).toBe(false);
    expect(
      canSubmitAccountDraft({
        ...base,
        hasMortgage: true,
        mortgageName: "Halifax mortgage",
      }),
    ).toBe(false);
  });

  test("a fully filled-in mortgage is submittable", () => {
    expect(
      canSubmitAccountDraft({
        ...base,
        hasMortgage: true,
        mortgageName: "Halifax mortgage",
        mortgageValue: "184200",
      }),
    ).toBe(true);
  });
});

describe("ACCOUNT_TYPES", () => {
  // The whole point of the merged picker: one choice determines both columns.
  test("every liability carries no wrapper, and every asset carries one", () => {
    for (const option of ACCOUNT_TYPES) {
      if (option.kind === "LIABILITY") expect(option.wrapper).toBeNull();
      else expect(option.wrapper).not.toBeNull();
    }
  });

  test("ids are unique", () => {
    const ids = ACCOUNT_TYPES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A cash ISA and an invested ISA share a wrapper deliberately — which is
  // why the section is asked separately and never inferred from it.
  test("two entries may share a wrapper", () => {
    const isas = ACCOUNT_TYPES.filter((o) => o.wrapper === "ISA");
    expect(isas.map((o) => o.id)).toEqual(["CASH_ISA", "STOCKS_ISA"]);
  });

  test("accountTypeById resolves a known id and rejects nothing gracefully", () => {
    expect(accountTypeById("MORTGAGE")?.kind).toBe("LIABILITY");
    expect(accountTypeById("STOCKS_ISA")?.wrapper).toBe("ISA");
    expect(accountTypeById(null)).toBeNull();
  });
});

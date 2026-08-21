import {
  canSubmitAccountDraft,
  defaultCanImportTransactions,
  resolveCanImportTransactions,
} from "@/lib/accounts/accountDraft";

describe("defaultCanImportTransactions", () => {
  test("an asset defaults on", () => {
    expect(defaultCanImportTransactions("ASSET", null)).toBe(true);
    expect(defaultCanImportTransactions("ASSET", "CURRENT")).toBe(true);
  });

  test("a liability defaults off, regardless of section", () => {
    expect(defaultCanImportTransactions("LIABILITY", null)).toBe(false);
    expect(defaultCanImportTransactions("LIABILITY", "LONG_TERM")).toBe(false);
  });

  test("a property asset defaults off — a property isn't a statement-import account", () => {
    expect(defaultCanImportTransactions("ASSET", "PROPERTY")).toBe(false);
  });
});

describe("resolveCanImportTransactions", () => {
  test("untouched: always mirrors the fresh default for the new type/section", () => {
    expect(resolveCanImportTransactions(true, false, "LIABILITY", null)).toBe(
      false,
    );
    expect(resolveCanImportTransactions(false, false, "ASSET", "CURRENT")).toBe(
      true,
    );
    expect(resolveCanImportTransactions(true, false, "ASSET", "PROPERTY")).toBe(
      false,
    );
  });

  // The subtlest rule the brief calls out: once touched, a type/section
  // change that would otherwise flip the fresh default must not un-check
  // (or re-check) the box behind the user's back.
  test("touched on, then switched to a section/type whose fresh default is off — the override sticks", () => {
    expect(
      resolveCanImportTransactions(true, true, "LIABILITY", "LONG_TERM"),
    ).toBe(true);
    expect(resolveCanImportTransactions(true, true, "ASSET", "PROPERTY")).toBe(
      true,
    );
  });

  test("touched off, then switched to a section/type whose fresh default is on — the override sticks", () => {
    expect(resolveCanImportTransactions(false, true, "ASSET", "CURRENT")).toBe(
      false,
    );
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

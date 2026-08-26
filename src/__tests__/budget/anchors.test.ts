import { assertAnchorMatches, requiredAnchorKind } from "@/lib/budget/anchors";

// The kind half of the create fence, pulled out of the action so the branch
// zod makes unreachable can still be pinned. A second fence exists precisely
// for the case where the first one is bypassed, so it must hold on its own.
describe("requiredAnchorKind", () => {
  test("maps the two anchored kinds and nothing else", () => {
    expect(requiredAnchorKind("TRANSFER")).toBe("ASSET");
    expect(requiredAnchorKind("REPAYMENT")).toBe("LIABILITY");
    expect(requiredAnchorKind("INCOME")).toBeNull();
    expect(requiredAnchorKind("EXPENSE")).toBeNull();
  });
});

describe("assertAnchorMatches", () => {
  test("accepts a transfer against an asset and a repayment against a liability", () => {
    expect(() => assertAnchorMatches("TRANSFER", "ASSET")).not.toThrow();
    expect(() => assertAnchorMatches("REPAYMENT", "LIABILITY")).not.toThrow();
  });

  test("rejects an anchored kind aimed at the wrong kind of account", () => {
    expect(() => assertAnchorMatches("TRANSFER", "LIABILITY")).toThrow(
      /must target an asset account/,
    );
    expect(() => assertAnchorMatches("REPAYMENT", "ASSET")).toThrow(
      /must target a liability account/,
    );
  });

  test("rejects an anchored kind aimed at a plain transaction account", () => {
    expect(() => assertAnchorMatches("TRANSFER", "NONE")).toThrow(/asset/);
    expect(() => assertAnchorMatches("REPAYMENT", "NONE")).toThrow(/liability/);
  });

  // INCOME/EXPENSE anchor to a category, never an account. Zod rejects such
  // input upstream, so nothing reaches here today — but a fence that waves the
  // row through when the kind is unexpected is no fence at all.
  test("rejects an unanchored kind reaching the account check at all", () => {
    expect(() => assertAnchorMatches("INCOME", "ASSET")).toThrow(
      /^Only TRANSFER and REPAYMENT anchor to an account$/,
    );
    expect(() => assertAnchorMatches("EXPENSE", "LIABILITY")).toThrow(
      /^Only TRANSFER and REPAYMENT anchor to an account$/,
    );
  });
});

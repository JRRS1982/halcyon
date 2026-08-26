import {
  type AnchorAccount,
  anchorTargetLabel,
  eligibleAnchorAccounts,
  rowsInSection,
  rowsOfType,
  sectionOf,
  skippedRowsNotice,
  transferRowLabel,
} from "@/lib/budget/sections";

describe("sectionOf", () => {
  test("repayments render under Expenses, where people look for a mortgage", () => {
    expect(sectionOf("REPAYMENT")).toBe("EXPENSES");
    expect(sectionOf("EXPENSE")).toBe("EXPENSES");
    expect(sectionOf("TRANSFER")).toBe("TRANSFERS");
    expect(sectionOf("INCOME")).toBe("INCOME");
  });
});

describe("transferRowLabel", () => {
  test("the sheet never shows the raw enum", () => {
    expect(transferRowLabel("INFLOW", "Vanguard ISA")).toBe("To Vanguard ISA");
    expect(transferRowLabel("OUTFLOW", "Vanguard ISA")).toBe(
      "From Vanguard ISA",
    );
  });
});

describe("anchorTargetLabel", () => {
  test("a transfer reads as the direction money moves from the user's side", () => {
    expect(anchorTargetLabel("TRANSFER", "INFLOW", "Vanguard ISA")).toBe(
      "To Vanguard ISA",
    );
    expect(anchorTargetLabel("TRANSFER", "OUTFLOW", "Vanguard ISA")).toBe(
      "From Vanguard ISA",
    );
  });

  test("a repayment names the debt it pays, and claims no direction", () => {
    expect(anchorTargetLabel("REPAYMENT", null, "Halifax Mortgage")).toBe(
      "Towards Halifax Mortgage",
    );
  });

  // A TRANSFER whose direction went missing must not be dressed up as an
  // inflow — the label says where the money went, and here we don't know.
  test("a directionless transfer names the account and nothing more", () => {
    expect(anchorTargetLabel("TRANSFER", null, "Vanguard ISA")).toBe(
      "Vanguard ISA",
    );
  });

  test("category-keyed rows have no target to name", () => {
    expect(anchorTargetLabel("INCOME", null, "Vanguard ISA")).toBeNull();
    expect(anchorTargetLabel("EXPENSE", null, "Vanguard ISA")).toBeNull();
  });
});

describe("eligibleAnchorAccounts", () => {
  const accounts: AnchorAccount[] = [
    { id: "a1", name: "Vanguard ISA", kind: "ASSET", archived: false },
    { id: "a2", name: "Old ISA", kind: "ASSET", archived: true },
    { id: "l1", name: "Halifax Mortgage", kind: "LIABILITY", archived: false },
    { id: "n1", name: "Current account", kind: "NONE", archived: false },
  ];

  test("a transfer may only target an asset account", () => {
    expect(
      eligibleAnchorAccounts("TRANSFER", accounts).map((a) => a.id),
    ).toEqual(["a1"]);
  });

  test("a repayment may only target a liability account", () => {
    expect(
      eligibleAnchorAccounts("REPAYMENT", accounts).map((a) => a.id),
    ).toEqual(["l1"]);
  });

  // Every account seeded at onboarding is kind NONE, so this is the state a
  // user who has never touched the balance sheet is actually in.
  test("kind NONE anchors nothing, so a fresh account list offers nothing", () => {
    const fresh: AnchorAccount[] = [
      { id: "n1", name: "Current account", kind: "NONE", archived: false },
      { id: "n2", name: "Savings", kind: "NONE", archived: false },
    ];
    expect(eligibleAnchorAccounts("TRANSFER", fresh)).toEqual([]);
    expect(eligibleAnchorAccounts("REPAYMENT", fresh)).toEqual([]);
  });

  test("category-keyed rows anchor to nothing at all", () => {
    expect(eligibleAnchorAccounts("INCOME", accounts)).toEqual([]);
    expect(eligibleAnchorAccounts("EXPENSE", accounts)).toEqual([]);
  });
});

describe("rowsInSection / rowsOfType", () => {
  const items = [
    { id: "i1", type: "INCOME" as const, sortOrder: 2 },
    { id: "i2", type: "INCOME" as const, sortOrder: 1 },
    { id: "e1", type: "EXPENSE" as const, sortOrder: 1 },
    { id: "r1", type: "REPAYMENT" as const, sortOrder: 5 },
    { id: "t1", type: "TRANSFER" as const, sortOrder: 3 },
  ];

  test("the Expenses section carries repayments as well as expenses", () => {
    expect(rowsInSection(items, "EXPENSES").map((i) => i.id)).toEqual([
      "e1",
      "r1",
    ]);
  });

  test("transfers get a section to themselves", () => {
    expect(rowsInSection(items, "TRANSFERS").map((i) => i.id)).toEqual(["t1"]);
  });

  test("rows come back in sortOrder, not the order they were stored", () => {
    expect(rowsInSection(items, "INCOME").map((i) => i.id)).toEqual([
      "i2",
      "i1",
    ]);
  });

  test("rowsOfType narrows to one kind, so repayments can head their own bucket", () => {
    expect(rowsOfType(items, "REPAYMENT").map((i) => i.id)).toEqual(["r1"]);
    expect(rowsOfType(items, "TRANSFER").map((i) => i.id)).toEqual(["t1"]);
  });
});

describe("skippedRowsNotice", () => {
  test("says nothing when nothing was skipped", () => {
    expect(skippedRowsNotice(0)).toBeNull();
  });

  test("counts one row in the singular", () => {
    expect(skippedRowsNotice(1)).toBe(
      "1 row was skipped because its account is no longer available.",
    );
  });

  test("counts several rows in the plural", () => {
    expect(skippedRowsNotice(3)).toBe(
      "3 rows were skipped because their accounts are no longer available.",
    );
  });
});

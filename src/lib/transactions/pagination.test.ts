import {
  PAGE_SIZE,
  pageCount,
  pageWindow,
  parseLedgerSearchParams,
} from "@/lib/transactions/pagination";

describe("parseLedgerSearchParams", () => {
  test("defaults when no params are present", () => {
    expect(parseLedgerSearchParams({})).toEqual({
      page: 1,
      search: "",
      onlyUncategorized: false,
      sortColumn: "date",
      sortDir: "desc",
      from: null,
      to: null,
      accountId: null,
      category: { kind: "any" },
      amountMin: null,
      amountMax: null,
    });
  });

  test("parses a full query string", () => {
    expect(
      parseLedgerSearchParams({
        page: "3",
        q: "tesco",
        uncat: "1",
        sort: "amount",
        dir: "asc",
        from: "2026-01-01",
        to: "2026-03-31",
        acct: "11111111-1111-1111-1111-111111111111",
        cat: "22222222-2222-2222-2222-222222222222",
        min: "10",
        max: "50.5",
      }),
    ).toEqual({
      page: 3,
      search: "tesco",
      onlyUncategorized: true,
      sortColumn: "amount",
      sortDir: "asc",
      from: "2026-01-01",
      to: "2026-03-31",
      accountId: "11111111-1111-1111-1111-111111111111",
      category: {
        kind: "category",
        categoryId: "22222222-2222-2222-2222-222222222222",
      },
      amountMin: 10,
      amountMax: 50.5,
    });
  });

  test("malformed values fall back to defaults", () => {
    const parsed = parseLedgerSearchParams({
      page: "banana",
      sort: "evil",
      dir: "sideways",
      uncat: "yes",
    });
    expect(parsed.page).toBe(1);
    expect(parsed.sortColumn).toBe("date");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.onlyUncategorized).toBe(false);
  });

  test("negative and zero pages clamp to 1; arrays take the first value", () => {
    expect(parseLedgerSearchParams({ page: "0" }).page).toBe(1);
    expect(parseLedgerSearchParams({ page: "-4" }).page).toBe(1);
    expect(parseLedgerSearchParams({ page: ["2", "9"] }).page).toBe(2);
  });

  test("over-long search input is truncated", () => {
    const parsed = parseLedgerSearchParams({ q: "x".repeat(500) });
    expect(parsed.search).toHaveLength(200);
  });

  test("only real calendar dates survive", () => {
    expect(parseLedgerSearchParams({ from: "2026-02-28" }).from).toBe(
      "2026-02-28",
    );
    expect(parseLedgerSearchParams({ from: "2026-02-30" }).from).toBeNull();
    expect(parseLedgerSearchParams({ from: "2026-13-01" }).from).toBeNull();
    expect(parseLedgerSearchParams({ to: "28/02/2026" }).to).toBeNull();
    expect(parseLedgerSearchParams({ to: "yesterday" }).to).toBeNull();
  });

  test("an out-of-order date range is kept as typed, not silently swapped", () => {
    const parsed = parseLedgerSearchParams({
      from: "2026-06-01",
      to: "2026-01-01",
    });
    expect(parsed.from).toBe("2026-06-01");
    expect(parsed.to).toBe("2026-01-01");
  });

  test("the transfers sentinel is distinct from a category id", () => {
    expect(parseLedgerSearchParams({ cat: "transfers" }).category).toEqual({
      kind: "transfers",
    });
    expect(
      parseLedgerSearchParams({ cat: "22222222-2222-2222-2222-222222222222" })
        .category,
    ).toEqual({
      kind: "category",
      categoryId: "22222222-2222-2222-2222-222222222222",
    });
    expect(parseLedgerSearchParams({ cat: "" }).category).toEqual({
      kind: "any",
    });
  });

  test("amount bounds reject non-numeric and negative input", () => {
    expect(parseLedgerSearchParams({ min: "0" }).amountMin).toBe(0);
    expect(parseLedgerSearchParams({ min: "12.34" }).amountMin).toBe(12.34);
    expect(parseLedgerSearchParams({ min: "banana" }).amountMin).toBeNull();
    // Amounts are matched on magnitude, so a negative bound is meaningless.
    expect(parseLedgerSearchParams({ max: "-5" }).amountMax).toBeNull();
    expect(parseLedgerSearchParams({ max: "Infinity" }).amountMax).toBeNull();
  });

  test("only uuid-shaped ids survive, since that is the column type", () => {
    // A non-uuid reaching Prisma is a 500, not an empty ledger, so the id is
    // shape-checked here rather than trusted downstream.
    expect(
      parseLedgerSearchParams({ acct: "11111111-1111-1111-1111-111111111111" })
        .accountId,
    ).toBe("11111111-1111-1111-1111-111111111111");
    expect(
      parseLedgerSearchParams({ acct: "no-such-account" }).accountId,
    ).toBeNull();
    expect(
      parseLedgerSearchParams({ acct: "x".repeat(200) }).accountId,
    ).toBeNull();
    expect(parseLedgerSearchParams({ cat: "'; drop table" }).category).toEqual({
      kind: "any",
    });
  });
});

describe("pageCount", () => {
  test("rounds up and never returns zero", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
    expect(pageCount(PAGE_SIZE * 4)).toBe(4);
  });
});

describe("pageWindow", () => {
  test("short ranges render every page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("collapses long runs into gaps around the current page", () => {
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  test("no gap at the edges when current is near them", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
    expect(pageWindow(12, 12)).toEqual([1, "gap", 11, 12]);
  });

  test("a single-page gap renders the page itself, not an ellipsis", () => {
    // pages 1..8 with current 4 → 1 [2 gap would be exactly page 2] 3 4 5 ... 8
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
  });
});

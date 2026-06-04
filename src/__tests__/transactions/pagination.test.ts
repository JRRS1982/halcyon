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
      }),
    ).toEqual({
      page: 3,
      search: "tesco",
      onlyUncategorized: true,
      sortColumn: "amount",
      sortDir: "asc",
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

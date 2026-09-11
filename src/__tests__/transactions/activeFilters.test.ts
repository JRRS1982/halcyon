const ACCOUNT = "11111111-1111-1111-1111-111111111111";
const CATEGORY = "22222222-2222-2222-2222-222222222222";

import { activeFilters } from "@/lib/transactions/activeFilters";
import { parseLedgerSearchParams } from "@/lib/transactions/pagination";

const LOOKUP = {
  accounts: [{ id: ACCOUNT, name: "Savings" }],
  categories: [{ id: CATEGORY, label: "Food" }],
};

const chips = (params: Record<string, string>) =>
  activeFilters(parseLedgerSearchParams(params), LOOKUP);

describe("activeFilters", () => {
  test("an unfiltered ledger has nothing to show or clear", () => {
    expect(chips({})).toEqual([]);
  });

  test("the search box keeps its own control, so it is not a chip", () => {
    expect(chips({ q: "tesco" })).toEqual([]);
  });

  test("uncategorized is a chip now that it lives inside the drawer", () => {
    // It used to have a visible toggle of its own in the toolbar. Inside the
    // drawer it is invisible state, and invisible state that hides rows is
    // exactly what the chips exist to prevent.
    expect(chips({ uncat: "1" })).toEqual([
      { key: "uncategorized", label: "Uncategorized", clear: { uncat: null } },
    ]);
  });

  test("a closed date range reads as one chip", () => {
    expect(chips({ from: "2026-01-01", to: "2026-03-31" })).toEqual([
      {
        key: "date",
        label: "1 Jan – 31 Mar 2026",
        clear: { from: null, to: null },
      },
    ]);
  });

  test("an open-ended date range says which end is bounded", () => {
    expect(chips({ from: "2026-01-01" })[0]?.label).toBe("From 1 Jan 2026");
    expect(chips({ to: "2026-03-31" })[0]?.label).toBe("Until 31 Mar 2026");
  });

  test("an account chip shows the account's name", () => {
    expect(chips({ acct: ACCOUNT })).toEqual([
      { key: "account", label: "Savings", clear: { acct: null } },
    ]);
  });

  test("a filter on something since deleted stays visible so it can be cleared", () => {
    // Losing the name must not lose the chip — an invisible filter that
    // silently hides rows is worse than an unhelpfully labelled one.
    expect(
      chips({ acct: "99999999-9999-9999-9999-999999999999" })[0]?.label,
    ).toBe("Unknown account");
    expect(
      chips({ cat: "99999999-9999-9999-9999-999999999999" })[0]?.label,
    ).toBe("Unknown category");
  });

  test("a category chip shows the category's label", () => {
    expect(chips({ cat: CATEGORY })).toEqual([
      { key: "category", label: "Food", clear: { cat: null } },
    ]);
  });

  test("the transfers filter reads as Transfers", () => {
    expect(chips({ cat: "transfers" })[0]?.label).toBe("Transfers");
  });

  test("amount chips describe whichever bounds are set", () => {
    expect(chips({ min: "10", max: "50" })[0]?.label).toBe(
      "Amount 10.00–50.00",
    );
    expect(chips({ min: "10" })[0]?.label).toBe("Amount 10.00+");
    expect(chips({ max: "50" })[0]?.label).toBe("Amount up to 50.00");
  });

  test("every filter gets its own chip, in drawer order", () => {
    const result = chips({
      uncat: "1",
      from: "2026-01-01",
      acct: ACCOUNT,
      cat: CATEGORY,
      min: "10",
    });
    expect(result.map((c) => c.key)).toEqual([
      "uncategorized",
      "date",
      "account",
      "category",
      "amount",
    ]);
  });
});

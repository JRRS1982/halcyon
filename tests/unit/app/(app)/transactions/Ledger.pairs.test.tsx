// The possible-transfers view: each pair is a summary line with its two rows
// beneath it, one tick selects both, and the pair actions send whole pairs.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  dismissPairs,
  markPairsAsTransfer,
  setTransactionCategory,
  unhidePairs,
  unmarkPairsAsTransfer,
} from "@/app/(app)/transactions/actions";
import { Ledger } from "@/app/(app)/transactions/Ledger";
import { theme } from "@/lib/theme";
import { parseLedgerSearchParams } from "@/lib/transactions/pagination";
import {
  type MarkedPair,
  type RowTag,
  UNTAGGED,
} from "@/lib/transactions/possibleTransfers";
import type {
  LedgerPage,
  LedgerPair,
  LedgerTransaction,
} from "@/lib/transactions/server";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/app/(app)/transactions/actions", () => ({
  bulkDeleteTransactions: jest.fn(),
  bulkSetTransactionCategory: jest.fn(),
  bulkSetTransactionTransfer: jest.fn(),
  createAccountAndTransfer: jest.fn(),
  createAndAssignCategory: jest.fn(),
  dismissPairs: jest.fn(async () => ({ ok: true, dismissed: 1, skipped: [] })),
  // By default the server marks every pair it is sent, each row having held
  // nothing before, and puts back every pair it is asked to.
  markPairsAsTransfer: jest.fn(
    async ({ pairs }: { pairs: { outId: string; inId: string }[] }) => ({
      updated: pairs.length * 2,
      skipped: 0,
      marked: pairs.map((pair) => ({
        ...pair,
        outBefore: {
          categoryId: null,
          transferAccountId: null,
          isCategoryConfirmed: true,
        },
        inBefore: {
          categoryId: null,
          transferAccountId: null,
          isCategoryConfirmed: true,
        },
      })),
    }),
  ),
  setTransactionCategory: jest.fn(),
  setTransactionNote: jest.fn(),
  setTransactionTransfer: jest.fn(),
  unhidePairs: jest.fn(async () => ({ unhidden: 1 })),
  unmarkPairsAsTransfer: jest.fn(async ({ pairs }: { pairs: unknown[] }) => ({
    restored: pairs.length,
    skipped: [],
  })),
}));

const CURRENT = "11111111-1111-1111-1111-111111111111";
const SAVINGS = "22222222-2222-2222-2222-222222222222";

const row = (
  id: string,
  amount: number,
  accountId: string,
  accountName: string,
  extra: Record<string, string> | null = null,
): LedgerTransaction => ({
  id,
  date: "2026-11-03",
  amount,
  description: `${accountName} row`,
  categoryId: null,
  isCategoryConfirmed: true,
  transferAccountId: null,
  accountId,
  accountName,
  note: "a note nobody should see here",
  extra,
});

const PAIR: LedgerPair = {
  outId: "out",
  inId: "in",
  amount: 200,
  daysApart: 1,
  earlierDate: "2026-11-03",
  otherMatches: 1,
  isTaggedElsewhere: false,
  outAccountName: "Current",
  inAccountName: "Savings",
  isHidden: false,
};

const renderPairs = (params: Record<string, string> = { pairs: "1" }) =>
  render(
    <ThemeProvider theme={theme}>
      <Ledger
        page={{
          items: [
            row("out", -200, CURRENT, "Current"),
            row("in", 200, SAVINGS, "Savings", { Type: "Faster payment" }),
          ],
          total: 1,
          pairs: [{ ...PAIR, isHidden: params.hidden === "1" }],
        }}
        query={parseLedgerSearchParams(params)}
        categories={[]}
        transferAccounts={[
          { id: CURRENT, name: "Current", kind: "ASSET" },
          { id: SAVINGS, name: "Savings", kind: "ASSET" },
        ]}
        transfersEnabled={true}
        currency="GBP"
        numberFormat="COMMA_2"
      />
    </ThemeProvider>,
  );

const tickPair = () =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Select pair Current → Savings/ }),
  );

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

const PAIR_IDS = { outId: "out", inId: "in" };

// Past the rows' fade-out, so a row still here is one that stayed.
const afterFade = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });

describe("possible transfers view", () => {
  test("sums the pair up in one line, with its warning", () => {
    renderPairs();
    expect(
      screen.getByText(/Current → Savings · £200\.00 · 1 day apart/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 other row could also match"),
    ).toBeInTheDocument();
  });

  test("one tick selects both rows", () => {
    renderPairs();
    tickPair();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  test("a row shows Details only when it kept import columns, and no note", () => {
    renderPairs();
    const outRow = screen.getByText("Current row").closest("tr");
    const inRow = screen.getByText("Savings row").closest("tr");
    if (!outRow || !inRow) throw new Error("rows not rendered");
    expect(
      within(outRow).queryByRole("button", { name: /Note|Details/ }),
    ).toBeNull();
    expect(
      within(inRow).getByRole("button", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("a note nobody should see here")).toBeNull();
  });

  test("Mark as transfer sends the whole pair", () => {
    renderPairs();
    tickPair();
    fireEvent.click(screen.getByRole("button", { name: "Mark as transfer" }));
    expect(markPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [{ outId: "out", inId: "in" }],
    });
  });

  test("Not a transfer hides the pair, and Undo brings it back", async () => {
    renderPairs();
    tickPair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Not a transfer" }));
    });
    expect(dismissPairs).toHaveBeenCalledWith({
      pairs: [{ outId: "out", inId: "in" }],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(unhidePairs).toHaveBeenCalledWith({
      pairs: [{ outId: "out", inId: "in" }],
    });
  });

  test("among hidden pairs the action is Unhide", () => {
    renderPairs({ pairs: "1", hidden: "1" });
    tickPair();
    expect(screen.queryByRole("button", { name: "Not a transfer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(unhidePairs).toHaveBeenCalledWith({
      pairs: [{ outId: "out", inId: "in" }],
    });
  });

  test("the footer counts pairs", () => {
    renderPairs();
    expect(screen.getByText("Total · 1 pair")).toBeInTheDocument();
  });

  test("a pair that no longer matched stays, and the ledger says why", async () => {
    jest.mocked(dismissPairs).mockResolvedValueOnce({
      ok: true,
      dismissed: 0,
      skipped: [PAIR_IDS],
    });
    renderPairs();
    tickPair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Not a transfer" }));
    });
    await afterFade();

    expect(screen.getByText("Current row")).toBeInTheDocument();
    expect(
      screen.getByText("1 pair no longer matched, so it is still listed."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  test("at the cap the pair stays and the reason is shown", async () => {
    jest.mocked(dismissPairs).mockResolvedValueOnce({
      ok: false,
      reason: "You can keep up to 10,000 hidden pairs. Unhide some first.",
    });
    renderPairs();
    tickPair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Not a transfer" }));
    });
    await afterFade();

    expect(screen.getByText("Current row")).toBeInTheDocument();
    expect(screen.getByText(/Unhide some first/)).toBeInTheDocument();
  });

  test("Mark as transfer says when a pair was left alone", async () => {
    jest.mocked(markPairsAsTransfer).mockResolvedValueOnce({
      updated: 0,
      skipped: 1,
      marked: [],
    });
    renderPairs();
    tickPair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark as transfer" }));
    });

    expect(screen.getByText(/1 pair was not marked/)).toBeInTheDocument();
  });

  test("the Undo stays while the pointer or focus is on it", async () => {
    jest.useFakeTimers();
    renderPairs();
    tickPair();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Not a transfer" }));
    });
    const undo = screen.getByRole("button", { name: "Undo" });

    fireEvent.mouseEnter(undo.parentElement as HTMLElement);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    fireEvent.mouseLeave(undo.parentElement as HTMLElement);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

// ─── Approving pairs ────────────────────────────────────────────────────────
// Each pair suggests its transfer in pencil and can be approved in one click,
// or every unwarned pair on the page at once; a second click puts the rows
// back.

const SALARY = "44444444-4444-4444-4444-444444444444";
const GROCERIES = "55555555-5555-5555-5555-555555555555";

// A pair named by its amount, so each summary line reads differently.
const pairOf = (
  amount: number,
  flags: Partial<LedgerPair> = {},
): LedgerPair => ({
  ...PAIR,
  outId: `out-${amount}`,
  inId: `in-${amount}`,
  amount,
  otherMatches: 0,
  ...flags,
});

const legs = (
  amount: number,
  tags: { out?: Partial<RowTag>; in?: Partial<RowTag> } = {},
): LedgerTransaction[] => [
  {
    ...row(`out-${amount}`, -amount, CURRENT, "Current"),
    description: `Out ${amount}`,
    ...tags.out,
  },
  {
    ...row(`in-${amount}`, amount, SAVINGS, "Savings"),
    description: `In ${amount}`,
    ...tags.in,
  },
];

const pageOf = (
  ...entries: { pair: LedgerPair; rows: LedgerTransaction[] }[]
): LedgerPage => ({
  items: entries.flatMap((entry) => entry.rows),
  total: entries.length,
  pairs: entries.map((entry) => entry.pair),
});

const clean = (amount: number, earlierDate = PAIR.earlierDate) => ({
  pair: pairOf(amount, { earlierDate }),
  rows: legs(amount),
});

const ledger = (
  page: LedgerPage,
  params: Record<string, string> = { pairs: "1" },
) => (
  <ThemeProvider theme={theme}>
    <Ledger
      page={page}
      query={parseLedgerSearchParams(params)}
      categories={[
        { id: SALARY, label: "Salary", type: "INCOME", section: "Other" },
        {
          id: GROCERIES,
          label: "Groceries",
          type: "EXPENSE",
          section: "Variable",
        },
      ]}
      transferAccounts={[
        { id: CURRENT, name: "Current", kind: "ASSET" },
        { id: SAVINGS, name: "Savings", kind: "ASSET" },
      ]}
      transfersEnabled={true}
      currency="GBP"
      numberFormat="COMMA_2"
      reviewAction={<button type="button">Approve all 9 suggested</button>}
    />
  </ThemeProvider>
);

const rowOf = (description: string) => {
  const tr = screen.getByText(description).closest("tr");
  if (!tr) throw new Error(`no row for ${description}`);
  return within(tr);
};

const approveButton = (amount: number) =>
  screen.getByRole("button", {
    name: new RegExp(`Approve transfer .*£${amount}\\.00`),
  });

const click = (button: HTMLElement) =>
  act(async () => {
    fireEvent.click(button);
  });

describe("a possible transfer's suggestion", () => {
  test("each row shows the transfer its pair suggests", () => {
    render(ledger(pageOf(clean(200))));
    expect(
      rowOf("Out 200").getByRole("button", { name: "Transfer to Savings" }),
    ).toBeInTheDocument();
    expect(
      rowOf("In 200").getByRole("button", { name: "Transfer from Current" }),
    ).toBeInTheDocument();
  });

  test("a row that already has a category keeps showing it", () => {
    render(
      ledger(
        pageOf({
          pair: pairOf(200),
          rows: legs(200, { in: { categoryId: SALARY } }),
        }),
      ),
    );
    expect(
      rowOf("In 200").getByRole("button", { name: /^Salary/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Transfer from Current")).toBeNull();
  });

  test("picking a category for a row replaces its suggestion", async () => {
    render(ledger(pageOf(clean(200))));
    fireEvent.click(
      rowOf("Out 200").getByRole("button", { name: "Transfer to Savings" }),
    );
    await click(screen.getByRole("option", { name: /Groceries/ }));

    expect(setTransactionCategory).toHaveBeenCalledWith({
      transactionId: "out-200",
      categoryId: GROCERIES,
    });
    expect(
      rowOf("Out 200").getByRole("button", { name: /^Groceries/ }),
    ).toBeInTheDocument();
  });

  // The user said these are not transfers.
  test("a hidden pair is suggested nothing and offers no approval", () => {
    render(
      ledger(
        pageOf({ pair: pairOf(200, { isHidden: true }), rows: legs(200) }),
        {
          pairs: "1",
          hidden: "1",
        },
      ),
    );
    expect(screen.queryByText("Transfer to Savings")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Approve transfer/ }),
    ).toBeNull();
  });
});

describe("approving one pair", () => {
  test("marks the pair, reads Approved and says so", async () => {
    render(ledger(pageOf(clean(200))));
    expect(approveButton(200)).toHaveTextContent("Approve transfer");

    await click(approveButton(200));

    expect(markPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [{ outId: "out-200", inId: "in-200" }],
    });
    expect(approveButton(200)).toHaveTextContent("✓ Approved");
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Both rows marked as a transfer.",
    );
  });

  test("a second click puts both rows back as the server said they were", async () => {
    const pencilled = { categoryId: SALARY, isCategoryConfirmed: false };
    const marked: MarkedPair = {
      outId: "out-200",
      inId: "in-200",
      outBefore: UNTAGGED,
      inBefore: { ...UNTAGGED, ...pencilled },
    };
    jest
      .mocked(markPairsAsTransfer)
      .mockResolvedValueOnce({ updated: 2, skipped: 0, marked: [marked] });
    render(
      ledger(pageOf({ pair: pairOf(200), rows: legs(200, { in: pencilled }) })),
    );
    await click(approveButton(200));
    expect(
      rowOf("In 200").getByRole("button", { name: "Transfer from Current" }),
    ).toBeInTheDocument();

    await click(approveButton(200));

    expect(unmarkPairsAsTransfer).toHaveBeenCalledWith({ pairs: [marked] });
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "false");
    expect(
      rowOf("In 200").getByRole("button", { name: /^Salary/ }),
    ).toBeInTheDocument();
    expect(
      rowOf("Out 200").getByRole("button", { name: "Transfer to Savings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Approval withdrawn: both rows are as they were.",
    );
  });

  test("a pair marked before this visit reads Approved and withdraws to uncategorised", async () => {
    render(
      ledger(
        pageOf({
          pair: pairOf(200),
          rows: legs(200, {
            out: { transferAccountId: SAVINGS },
            in: { transferAccountId: CURRENT },
          }),
        }),
      ),
    );
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "true");

    await click(approveButton(200));

    expect(unmarkPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [
        {
          outId: "out-200",
          inId: "in-200",
          outBefore: UNTAGGED,
          inBefore: UNTAGGED,
        },
      ],
    });
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "false");
  });

  // Withdrawing needs the server's answer to the approval, so a second click
  // must not land before it.
  test("the buttons wait while an approval is being saved", async () => {
    let answer: (value: {
      updated: number;
      skipped: number;
      marked: MarkedPair[];
    }) => void = () => {};
    jest.mocked(markPairsAsTransfer).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(ledger(pageOf(clean(200))));

    await click(approveButton(200));
    expect(approveButton(200)).toBeDisabled();
    expect(approveButton(200)).toHaveTextContent("Approving…");
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      answer({ updated: 0, skipped: 1, marked: [] });
    });
    expect(approveButton(200)).toBeEnabled();
    expect(approveButton(200)).toHaveTextContent("Approve transfer");
  });

  test("a pair the server would not mark stays as it was, with the reason", async () => {
    jest
      .mocked(markPairsAsTransfer)
      .mockResolvedValueOnce({ updated: 0, skipped: 1, marked: [] });
    render(ledger(pageOf(clean(200))));

    await click(approveButton(200));

    expect(approveButton(200)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      /1 pair was not marked/,
    );
  });

  test("a pair the server would not put back stays approved, with the reason", async () => {
    render(ledger(pageOf(clean(200))));
    await click(approveButton(200));
    jest.mocked(unmarkPairsAsTransfer).mockResolvedValueOnce({
      restored: 0,
      skipped: [{ outId: "out-200", inId: "in-200" }],
    });

    await click(approveButton(200));

    expect(approveButton(200)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 pair was left as it is: its rows have changed since.",
    );
  });
});

describe("approving every pair on the page", () => {
  const warned = {
    pair: pairOf(75, { otherMatches: 1 }),
    rows: legs(75),
  };

  test("takes the pairs without a warning and says what it left", async () => {
    render(ledger(pageOf(clean(200), clean(50), warned)));

    await click(screen.getByRole("button", { name: "Approve all 2" }));

    expect(markPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [
        { outId: "out-200", inId: "in-200" },
        { outId: "out-50", inId: "in-50" },
      ],
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 pairs marked as transfers; 1 with a warning left for you.",
    );
    expect(approveButton(75)).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "✓ All approved" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("says it is withdrawing while the server is asked", async () => {
    render(ledger(pageOf(clean(200), clean(50))));
    await click(screen.getByRole("button", { name: "Approve all 2" }));
    let answer: (value: {
      restored: number;
      skipped: { outId: string; inId: string }[];
    }) => void = () => {};
    jest.mocked(unmarkPairsAsTransfer).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    await click(screen.getByRole("button", { name: "✓ All approved" }));
    expect(screen.getByRole("button", { name: "Withdrawing…" })).toBeDisabled();
    // Only the button that was pressed says so.
    expect(approveButton(200)).toHaveTextContent("✓ Approved");

    await act(async () => {
      answer({ restored: 2, skipped: [] });
    });
    expect(screen.getByRole("button", { name: "Approve all 2" })).toBeEnabled();
  });

  test("a second click withdraws them all", async () => {
    render(ledger(pageOf(clean(200), clean(50))));
    await click(screen.getByRole("button", { name: "Approve all 2" }));

    await click(screen.getByRole("button", { name: "✓ All approved" }));

    expect(unmarkPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [
        expect.objectContaining({ outId: "out-200", inId: "in-200" }),
        expect.objectContaining({ outId: "out-50", inId: "in-50" }),
      ],
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Approval withdrawn from 2 pairs: their rows are as they were.",
    );
    expect(
      screen.getByRole("button", { name: "Approve all 2" }),
    ).toBeInTheDocument();
  });

  // One click must never untag transfers made long before this visit.
  test("withdrawing all leaves a pair marked before this visit", async () => {
    const before = {
      pair: pairOf(200),
      rows: legs(200, {
        out: { transferAccountId: SAVINGS },
        in: { transferAccountId: CURRENT },
      }),
    };
    render(ledger(pageOf(before, clean(50))));
    await click(screen.getByRole("button", { name: "Approve all 1" }));

    await click(screen.getByRole("button", { name: "✓ All approved" }));

    expect(unmarkPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [expect.objectContaining({ outId: "out-50", inId: "in-50" })],
    });
    expect(approveButton(200)).toHaveAttribute("aria-pressed", "true");
  });

  test("offers nothing when every pair was marked before this visit", () => {
    render(
      ledger(
        pageOf({
          pair: pairOf(200),
          rows: legs(200, {
            out: { transferAccountId: SAVINGS },
            in: { transferAccountId: CURRENT },
          }),
        }),
      ),
    );
    expect(screen.queryByRole("button", { name: /All approved/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Approve all/ })).toBeNull();
  });

  // Two "Approve all" buttons side by side would read as one button twice.
  test("stands in for the categories' Approve all in this view only", () => {
    const { unmount } = render(ledger(pageOf(clean(200))));
    expect(
      screen.queryByRole("button", { name: "Approve all 9 suggested" }),
    ).toBeNull();
    unmount();

    render(
      ledger(
        pageOf({ pair: pairOf(200, { isHidden: true }), rows: legs(200) }),
        {
          pairs: "1",
          hidden: "1",
        },
      ),
    );
    expect(
      screen.getByRole("button", { name: "Approve all 9 suggested" }),
    ).toBeInTheDocument();
  });
});

describe("an approved pair the page stops listing", () => {
  const uncat = { pairs: "1", uncat: "1" };

  test("stays, in its place, with its toggle", async () => {
    // Newest first, as the server lists them.
    const newest = clean(200, "2026-11-09");
    const middle = clean(50, "2026-11-06");
    const oldest = clean(20, "2026-11-03");
    const { rerender } = render(ledger(pageOf(newest, middle, oldest), uncat));
    await click(approveButton(50));

    // The refreshed page: Uncategorised only no longer matches the pair.
    rerender(ledger(pageOf(newest, oldest), uncat));

    expect(approveButton(50)).toHaveAttribute("aria-pressed", "true");
    expect(
      screen
        .getAllByRole("checkbox", { name: /Select pair/ })
        .map((box) => box.getAttribute("aria-label")),
    ).toEqual([
      expect.stringContaining("£200.00"),
      expect.stringContaining("£50.00"),
      expect.stringContaining("£20.00"),
    ]);
    expect(screen.getByText("Total · 3 pairs")).toBeInTheDocument();
  });

  test("and still withdraws", async () => {
    const { rerender } = render(ledger(pageOf(clean(200), clean(50)), uncat));
    await click(approveButton(50));
    rerender(ledger(pageOf(clean(200)), uncat));

    await click(approveButton(50));

    expect(unmarkPairsAsTransfer).toHaveBeenCalledWith({
      pairs: [expect.objectContaining({ outId: "out-50", inId: "in-50" })],
    });
    expect(
      rowOf("Out 50").getByRole("button", { name: "Transfer to Savings" }),
    ).toBeInTheDocument();
  });

  test("goes when the filter changes", async () => {
    const { rerender } = render(ledger(pageOf(clean(200), clean(50)), uncat));
    await click(approveButton(50));

    rerender(ledger(pageOf(clean(200)), { ...uncat, min: "100" }));

    expect(screen.queryByText("Out 50")).toBeNull();
    expect(screen.getByText("Total · 1 pair")).toBeInTheDocument();
  });

  test("a pair the server would not mark is not kept", async () => {
    jest
      .mocked(markPairsAsTransfer)
      .mockResolvedValueOnce({ updated: 0, skipped: 1, marked: [] });
    const { rerender } = render(ledger(pageOf(clean(200), clean(50)), uncat));
    await click(approveButton(50));

    // It no longer matched, so the refreshed page has dropped it.
    rerender(ledger(pageOf(clean(200)), uncat));

    expect(screen.queryByText("Out 50")).toBeNull();
  });
});

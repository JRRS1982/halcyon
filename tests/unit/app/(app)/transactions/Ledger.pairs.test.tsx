// The possible-transfers view: each pair is a summary line with its two rows
// beneath it, one tick selects both, and the pair actions send whole pairs.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  dismissPairs,
  markPairsAsTransfer,
  unhidePairs,
} from "@/app/(app)/transactions/actions";
import { Ledger } from "@/app/(app)/transactions/Ledger";
import { theme } from "@/lib/theme";
import { parseLedgerSearchParams } from "@/lib/transactions/pagination";
import type { LedgerPair, LedgerTransaction } from "@/lib/transactions/server";

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
  dismissPairs: jest.fn(async () => ({ dismissed: 1 })),
  markPairsAsTransfer: jest.fn(async () => ({ updated: 2 })),
  setTransactionCategory: jest.fn(),
  setTransactionNote: jest.fn(),
  setTransactionTransfer: jest.fn(),
  unhidePairs: jest.fn(async () => ({ unhidden: 1 })),
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
});

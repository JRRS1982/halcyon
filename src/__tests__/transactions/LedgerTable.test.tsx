// The ledger table's own chrome: a distinct header row, and a footer that nets
// the page it is actually showing.

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { Ledger } from "@/app/(app)/transactions/Ledger";
import { theme } from "@/lib/theme";
import { parseLedgerSearchParams } from "@/lib/transactions/pagination";

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
  setTransactionCategory: jest.fn(),
  setTransactionNote: jest.fn(),
  setTransactionTransfer: jest.fn(),
}));

const ACCOUNT = "22222222-2222-2222-2222-222222222222";

const row = (id: string, amount: number) => ({
  id,
  date: "2026-01-15",
  amount,
  description: id,
  categoryId: null,
  transferAccountId: null,
  accountId: ACCOUNT,
  accountName: "Current",
  note: null,
  extra: null,
});

const renderLedger = (amounts: number[], total = amounts.length) =>
  render(
    <ThemeProvider theme={theme}>
      <Ledger
        page={{
          items: amounts.map((amount, i) => row(`tx${i}`, amount)),
          total,
        }}
        query={parseLedgerSearchParams({})}
        categories={[]}
        transferAccounts={[]}
        uncategorizedCount={0}
        transfersEnabled={true}
      />
    </ThemeProvider>,
  );

describe("ledger total row", () => {
  test("nets the rows on screen", () => {
    renderLedger([-12.5, -7.5]);
    expect(screen.getByText("Total · 2 transactions")).toBeInTheDocument();
    // ASCII hyphen, matching the amount cells this row sums.
    expect(screen.getByText("-20.00")).toBeInTheDocument();
  });

  test("says which page it is when the matches spill past it", () => {
    renderLedger([-12.5, -7.5], 312);
    expect(screen.getByText("This page · 2 of 312")).toBeInTheDocument();
  });

  test("an empty ledger has no total to show", () => {
    renderLedger([]);
    expect(screen.queryByText(/transactions?$/)).toBeNull();
  });
});

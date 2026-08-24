// src/__tests__/transactions/Ledger.test.tsx
//
// The transactions page queries two account lists: an importable-only list
// (canImportTransactions: true) for the import picker/quick-add, and a full,
// unfiltered list for transfer targets and transferAccountId display
// resolution — see CategoryCombobox's `transferAccounts` prop. This file
// pins the second half: an account excluded from import must still resolve
// to its name on a row that already points a transfer at it.

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { Ledger } from "@/app/(app)/transactions/Ledger";
import { theme } from "@/lib/theme";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
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

// The mortgage would have canImportTransactions: false in the real query —
// it must be absent from the page's importable list but present here.
const mortgageAccountId = "11111111-1111-1111-1111-111111111111";
const currentAccountId = "22222222-2222-2222-2222-222222222222";

const renderLedger = () =>
  render(
    <ThemeProvider theme={theme}>
      <Ledger
        page={{
          items: [
            {
              id: "tx1",
              date: "2026-01-15",
              amount: -500,
              description: "Mortgage payment",
              categoryId: null,
              transferAccountId: mortgageAccountId,
              accountId: currentAccountId,
              accountName: "Current",
              note: null,
              extra: null,
            },
          ],
          total: 1,
        }}
        query={{
          page: 1,
          search: "",
          onlyUncategorized: false,
          sortColumn: "date",
          sortDir: "desc",
        }}
        categories={[]}
        transferAccounts={[{ id: mortgageAccountId, name: "Halifax mortgage" }]}
        uncategorizedCount={0}
        transfersEnabled={true}
      />
    </ThemeProvider>,
  );

describe("Ledger transfer display", () => {
  test("resolves a transferAccountId to its name even when the account is import-excluded", () => {
    renderLedger();

    expect(screen.getByText("Halifax mortgage")).toBeInTheDocument();
    // The row's own combobox trigger (unlike the always-present bulk bar
    // combobox) defaults to this placeholder when it has nothing to show —
    // it must not fall back to it here.
    expect(screen.queryByText("— Uncategorized —")).not.toBeInTheDocument();
  });
});

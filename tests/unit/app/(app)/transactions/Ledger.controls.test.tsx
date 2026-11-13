// The controls card: everything that acts on the ledger, in one bounded
// surface separated from the table. It is contextual — with a selection the
// search box becomes the categorize box, because once rows are selected you
// have already found them and the box's job changes.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  bulkSetTransactionCategory,
  setTransactionCategory,
} from "@/app/(app)/transactions/actions";
import { Ledger } from "@/app/(app)/transactions/Ledger";
import { theme } from "@/lib/theme";
import { parseLedgerSearchParams } from "@/lib/transactions/pagination";

const replace = jest.fn();
let currentParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn(), replace }),
  useSearchParams: () => currentParams,
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

const renderLedger = (search = "") => {
  currentParams = new URLSearchParams(search);
  return render(
    <ThemeProvider theme={theme}>
      <Ledger
        page={{
          items: [
            {
              id: "tx1",
              date: "2026-01-15",
              amount: -12.5,
              description: "Greggs",
              categoryId: null,
              transferAccountId: null,
              isCategoryConfirmed: true,
              accountId: ACCOUNT,
              accountName: "Current",
              note: null,
              extra: null,
            },
            {
              id: "tx2",
              date: "2026-01-16",
              amount: -7.5,
              description: "Tesco",
              categoryId: null,
              transferAccountId: null,
              isCategoryConfirmed: true,
              accountId: ACCOUNT,
              accountName: "Current",
              note: null,
              extra: null,
            },
          ],
          total: 2,
        }}
        query={parseLedgerSearchParams(
          Object.fromEntries(currentParams.entries()),
        )}
        categories={[
          {
            id: "33333333-3333-3333-3333-333333333333",
            label: "Food",
            type: "EXPENSE",
            section: "Variable",
          },
        ]}
        transferAccounts={[{ id: ACCOUNT, name: "Current", kind: "ASSET" }]}
        transfersEnabled={true}
      />
    </ThemeProvider>,
  );
};

const selectRow = (description: string) =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: `Select ${description}` }),
  );

const FOOD = "33333333-3333-3333-3333-333333333333";

// Picks Food from the category box on one row, not from the controls card.
const categoriseOnRow = (description: string) => {
  const row = screen.getByRole("row", { name: new RegExp(description) });
  fireEvent.click(
    within(row).getByRole("button", { name: "— Uncategorised —" }),
  );
  // The pick starts a transition around the server action; act lets it settle.
  return act(async () => {
    fireEvent.click(within(row).getByRole("option", { name: /Food/ }));
  });
};

beforeEach(() => {
  replace.mockClear();
  jest.mocked(bulkSetTransactionCategory).mockClear();
  jest.mocked(setTransactionCategory).mockClear();
});

describe("ledger controls card", () => {
  test("with no selection it offers only filtering and search", () => {
    renderLedger();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search description…"),
    ).toBeInTheDocument();
    // Destructive and selection-only actions do not sit greyed out waiting.
    expect(screen.queryByRole("button", { name: "Delete…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  test("the uncategorized toggle has moved into the drawer", () => {
    renderLedger();
    expect(
      screen.queryByRole("checkbox", { name: "Uncategorised only" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(
      screen.getByRole("checkbox", { name: "Uncategorised only" }),
    ).toBeInTheDocument();
  });

  test("selecting a row turns the search box into the categorize box", () => {
    renderLedger();
    selectRow("Greggs");

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    // Hidden, not unmounted — see the surviving-search test below.
    expect(
      screen.getByPlaceholderText("Search description…"),
    ).not.toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Set category for selected transactions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  test("the count tracks the selection", () => {
    renderLedger();
    selectRow("Greggs");
    selectRow("Tesco");
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  test("clearing the selection gives the search box back", () => {
    renderLedger();
    selectRow("Greggs");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByPlaceholderText("Search description…"),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 selected")).toBeNull();
  });

  test("a search in progress survives a selection and comes back intact", () => {
    // The box is reused, not remounted — losing the typed query on a stray
    // row click would be the same silent input loss the debounce guard exists
    // to prevent.
    renderLedger("q=greg");
    expect(screen.getByPlaceholderText("Search description…")).toHaveValue(
      "greg",
    );
    selectRow("Greggs");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByPlaceholderText("Search description…")).toHaveValue(
      "greg",
    );
  });

  test("categorising on a selected row categorises the whole selection", async () => {
    // Ticking five rows and then picking a category on one of them used to
    // file only that one, leaving the other four ticked and untouched.
    renderLedger();
    selectRow("Greggs");
    selectRow("Tesco");
    await categoriseOnRow("Greggs");

    expect(bulkSetTransactionCategory).toHaveBeenCalledWith({
      transactionIds: ["tx1", "tx2"],
      categoryId: FOOD,
    });
    expect(setTransactionCategory).not.toHaveBeenCalled();
    expect(screen.queryByText("2 selected")).toBeNull();
  });

  test("categorising on a row outside the selection touches only that row", async () => {
    renderLedger();
    selectRow("Greggs");
    await categoriseOnRow("Tesco");

    expect(setTransactionCategory).toHaveBeenCalledWith({
      transactionId: "tx2",
      categoryId: FOOD,
    });
    expect(bulkSetTransactionCategory).not.toHaveBeenCalled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});

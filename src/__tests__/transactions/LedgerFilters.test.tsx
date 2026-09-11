// The ledger's filter drawer, its chip row, and the count badge that ties
// them together. The drawer hides its own state while closed, so the chips
// and the badge are the only evidence a filter is on — they are what these
// tests pin, alongside the single navigation each gesture writes.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
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

const SAVINGS = "11111111-1111-1111-1111-111111111111";
const CURRENT = "22222222-2222-2222-2222-222222222222";
const FOOD = "33333333-3333-3333-3333-333333333333";

const renderLedger = (search: string) => {
  currentParams = new URLSearchParams(search);
  const query = parseLedgerSearchParams(
    Object.fromEntries(currentParams.entries()),
  );
  return render(
    <ThemeProvider theme={theme}>
      <Ledger
        page={{ items: [], total: 0 }}
        query={query}
        categories={[
          { id: FOOD, label: "Food", type: "EXPENSE", section: "Variable" },
        ]}
        transferAccounts={[
          { id: SAVINGS, name: "Savings", kind: "ASSET" },
          { id: CURRENT, name: "Current", kind: "ASSET" },
        ]}
        uncategorizedCount={0}
        transfersEnabled={true}
      />
    </ThemeProvider>,
  );
};

const lastReplacedParams = () => {
  const url = replace.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split("?")[1] ?? "");
};

beforeEach(() => {
  replace.mockClear();
});

describe("ledger filter chips and badge", () => {
  test("an unfiltered ledger offers Filters with no count and no chips", () => {
    renderLedger("");
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  });

  test("the badge counts the filters the chips show", () => {
    renderLedger(`from=2026-01-01&to=2026-03-31&acct=${SAVINGS}`);
    expect(
      screen.getByRole("button", { name: "Filters (2 active)" }),
    ).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("1 Jan – 31 Mar 2026")).toBeInTheDocument();
    expect(within(chips).getByText("Savings")).toBeInTheDocument();
  });

  test("the search box is not counted as a filter, but uncategorized is", () => {
    // The search has its own control in the card; uncategorized moved into
    // the drawer, so the badge is the only thing that reports it.
    renderLedger("q=tesco");
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();

    renderLedger("q=tesco&uncat=1");
    expect(
      screen.getByRole("button", { name: "Filters (1 active)" }),
    ).toBeInTheDocument();
  });

  test("removing a chip drops only that filter and returns to page 1", () => {
    renderLedger(`page=4&q=tesco&acct=${SAVINGS}&min=10`);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Savings" }),
    );
    const params = lastReplacedParams();
    expect(params.get("acct")).toBeNull();
    expect(params.get("min")).toBe("10");
    expect(params.get("q")).toBe("tesco");
    expect(params.get("page")).toBeNull();
  });

  test("removing the date chip clears both of its ends", () => {
    renderLedger("from=2026-01-01&to=2026-03-31");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove filter: 1 Jan – 31 Mar 2026",
      }),
    );
    const params = lastReplacedParams();
    expect(params.get("from")).toBeNull();
    expect(params.get("to")).toBeNull();
  });
});

describe("ledger filter drawer", () => {
  const openDrawer = () =>
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

  test("the drawer opens prefilled from the URL", () => {
    renderLedger(`from=2026-01-01&acct=${SAVINGS}&cat=${FOOD}&max=50`);
    openDrawer();
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Account")).toHaveValue(SAVINGS);
    expect(screen.getByLabelText("Category")).toHaveValue(FOOD);
    expect(screen.getByLabelText("Maximum")).toHaveValue(50);
  });

  test("editing fields writes nothing until Apply", () => {
    renderLedger("");
    openDrawer();
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "25" },
    });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(replace).toHaveBeenCalledTimes(1);
    const params = lastReplacedParams();
    expect(params.get("from")).toBe("2026-05-01");
    expect(params.get("min")).toBe("25");
  });

  test("a preset fills both ends of the range", () => {
    renderLedger("");
    openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "This year" }));
    expect(screen.getByLabelText("From")).toHaveValue(
      `${new Date().getUTCFullYear()}-01-01`,
    );
    expect(screen.getByLabelText("To")).toHaveValue(
      new Date().toISOString().slice(0, 10),
    );
  });

  test("the transfers option is offered alongside the categories", () => {
    renderLedger("");
    openDrawer();
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "transfers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(lastReplacedParams().get("cat")).toBe("transfers");
  });

  test("Clear all drops every drawer filter but leaves the search alone", () => {
    renderLedger(`q=tesco&uncat=1&from=2026-01-01&acct=${SAVINGS}&min=10`);
    openDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    const params = lastReplacedParams();
    expect(params.get("from")).toBeNull();
    expect(params.get("acct")).toBeNull();
    expect(params.get("min")).toBeNull();
    // uncat is a drawer filter now, so Clear all owns it too.
    expect(params.get("uncat")).toBeNull();
    // The search box is not in the drawer, so Clear all does not reach it.
    expect(params.get("q")).toBe("tesco");
  });
});

describe("ledger filter drawer draft", () => {
  test("a server re-render while the drawer is open does not wipe an edit", () => {
    // `query` is a fresh object on every server render, so a revalidation
    // landing mid-edit must not be mistaken for the drawer being reopened.
    const { rerender } = renderLedger("");
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "25" },
    });

    rerender(
      <ThemeProvider theme={theme}>
        <Ledger
          page={{ items: [], total: 0 }}
          // Same values, new identity — exactly what a re-render produces.
          query={parseLedgerSearchParams({})}
          categories={[]}
          transferAccounts={[]}
          uncategorizedCount={0}
          transfersEnabled={true}
        />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText("Minimum")).toHaveValue(25);
  });
});

describe("ledger empty state under a filter", () => {
  test("a filter matching nothing does not read as a brand-new ledger", () => {
    // The first-run copy invites an import. Shown to someone whose filter
    // simply matched nothing, it implies their transactions are gone.
    renderLedger("from=2026-01-01&to=2026-01-31");
    expect(screen.getByText("No transactions match.")).toBeInTheDocument();
    expect(screen.queryByText(/import a statement above/)).toBeNull();
  });

  test("a genuinely empty ledger still gets the first-run invitation", () => {
    renderLedger("");
    expect(screen.getByText(/import a statement above/)).toBeInTheDocument();
  });
});

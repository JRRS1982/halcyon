// src/__tests__/budget/BudgetSheet.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  BudgetSheet,
  type SerializedItem,
  type SerializedPeriod,
} from "@/app/(app)/budget/BudgetSheet";
import type { AnchorAccount } from "@/lib/budget/sections";
import { formatAmount } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const createItemForMonth = jest.fn();
const copyPeriodFrom = jest.fn();
const listCopyablePeriods = jest.fn();
const deleteItem = jest.fn();
// The transfer picker can open the balance sheet's own Add-account drawer, so
// that feature's server actions are now in this file's module graph.
jest.mock("@/app/(app)/balance/accountActions", () => ({
  createAccountWithBalance: jest.fn(),
}));

jest.mock("@/app/(app)/budget/actions", () => ({
  copyPeriodFrom: (...args: unknown[]) => copyPeriodFrom(...args),
  createItemForMonth: (...args: unknown[]) => createItemForMonth(...args),
  deleteItem: (...args: unknown[]) => deleteItem(...args),
  listCopyablePeriods: (...args: unknown[]) => listCopyablePeriods(...args),
  updateItem: jest.fn(),
}));

const period: SerializedPeriod = {
  id: "11111111-1111-1111-1111-111111111111",
  label: "March 2026",
  startDate: "2026-03-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
};

const ISA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MORTGAGE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const accounts: AnchorAccount[] = [
  { id: ISA, name: "Vanguard ISA", kind: "ASSET", archived: false },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    name: "Old ISA",
    kind: "ASSET",
    archived: true,
  },
  {
    id: MORTGAGE,
    name: "Halifax Mortgage",
    kind: "LIABILITY",
    archived: false,
  },
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    name: "Current account",
    kind: "NONE",
    archived: false,
  },
];

const row = (
  over: Partial<SerializedItem> & { id: string },
): SerializedItem => ({
  type: "EXPENSE",
  category: "FIXED",
  incomeCategory: null,
  categoryId: null,
  accountId: null,
  direction: null,
  label: "",
  budget: 0,
  actual: 0,
  sortOrder: 1,
  ...over,
});

const items: SerializedItem[] = [
  row({
    id: "1",
    type: "INCOME",
    category: null,
    incomeCategory: "SALARY",
    label: "Salary",
    budget: 8500,
    actual: 8000,
  }),
  row({ id: "2", label: "Housing", budget: 2200, actual: 2000, sortOrder: 2 }),
  row({
    id: "3",
    type: "REPAYMENT",
    category: null,
    accountId: MORTGAGE,
    label: "Mortgage",
    budget: 1250,
    actual: 1250,
    sortOrder: 3,
  }),
  row({
    id: "4",
    type: "TRANSFER",
    category: null,
    accountId: ISA,
    direction: "INFLOW",
    label: "ISA contribution",
    budget: 500,
    actual: 400,
    sortOrder: 4,
  }),
];

// The sheet with nothing anchored yet: both accounts are still on offer,
// because one account may carry at most one row per period.
const unanchoredItems = items.filter((i) => i.accountId === null);

const fmt = (n: number) => formatAmount("GBP", n, "COMMA_0");

const renderSheet = (
  initialItems: SerializedItem[] = items,
  sheetAccounts: AnchorAccount[] = accounts,
) =>
  render(
    <ThemeProvider theme={theme}>
      <BudgetSheet
        period={period}
        initialItems={initialItems}
        accounts={sheetAccounts}
        year={2026}
        month={2}
        currency="GBP"
        numberFormat="COMMA_0"
      />
    </ThemeProvider>,
  );

const bandFor = (name: string): HTMLElement => {
  const band = screen.getByRole("rowheader", { name }).closest('[role="row"]');
  if (!(band instanceof HTMLElement)) throw new Error(`No row for ${name}`);
  return band;
};

beforeEach(() => {
  createItemForMonth.mockReset();
  copyPeriodFrom.mockReset();
  listCopyablePeriods.mockReset().mockResolvedValue([]);
});

describe("BudgetSheet — three sections", () => {
  test("a repayment renders inside Expenses and counts in that total", () => {
    renderSheet();
    const expenses = bandFor("Expenses");
    // 2200 + 1250 budgeted, 2000 + 1250 spent — the payment that actually
    // left is part of what was spent.
    expect(within(expenses).getByText(fmt(3450))).toBeInTheDocument();
    expect(within(expenses).getByText(fmt(3250))).toBeInTheDocument();
    // The bucket's accessible name carries its info button's "i" too.
    expect(
      screen.getByRole("rowheader", { name: /^Debt payments/ }),
    ).toBeVisible();
  });

  test("transfers get a section of their own", () => {
    renderSheet();
    const transfers = bandFor("Transfers and saving");
    expect(within(transfers).getByText(fmt(500))).toBeInTheDocument();
    expect(within(transfers).getByText(fmt(400))).toBeInTheDocument();
  });

  test("the sheet names the account, never the raw enum", () => {
    renderSheet();
    expect(screen.getByText("To Vanguard ISA")).toBeInTheDocument();
    expect(screen.getByText("Towards Halifax Mortgage")).toBeInTheDocument();
    expect(screen.queryByText(/INFLOW|OUTFLOW/)).not.toBeInTheDocument();
  });

  // Budgeted: 8500 − 2200 − 1250 − 500 into the ISA. Actual: 8000 − 2000 −
  // 1250 − 400. The transfer is not spending, but the money did leave the
  // user's pocket, so it moves what is left over.
  test("the bottom line subtracts a transfer as well as the expenses", () => {
    renderSheet();
    const left = bandFor("Left over");
    expect(within(left).getByText(`+${fmt(4550)}`)).toBeInTheDocument();
    expect(within(left).getByText(`+${fmt(4350)}`)).toBeInTheDocument();
  });
});

describe("BudgetSheet — the Add drawer's account picker", () => {
  // One "+ Add" opens the drawer; the kind is its first field. Both clicks
  // are one user gesture, so they share an act().
  const openAddDrawer = async (kind: "Transfer" | "Repayment") => {
    await act(async () => {
      screen.getByRole("button", { name: "+ Add" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: kind }).click();
    });
  };

  test("a transfer may only target an asset account", async () => {
    renderSheet(unanchoredItems);
    await openAddDrawer("Transfer");
    expect(screen.getByRole("button", { name: "Vanguard ISA" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Halifax Mortgage" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Current account" }),
    ).not.toBeInTheDocument();
    // Archived accounts still name an existing row's target, but can never be
    // a new row's.
    expect(
      screen.queryByRole("button", { name: "Old ISA" }),
    ).not.toBeInTheDocument();
  });

  // Two rows on one account would each render the account's whole net, and the
  // section would count it twice — the flow data cannot tell them apart. The
  // fixture already carries an ISA transfer and a mortgage repayment, so both
  // pickers should now be empty.
  test("an account already anchored this month is no longer on offer", async () => {
    renderSheet();
    await openAddDrawer("Transfer");
    expect(
      screen.queryByRole("button", { name: "Vanguard ISA" }),
    ).not.toBeInTheDocument();
    // And it says why. Sending the user to the balance sheet to create an
    // account they already have would be a lie.
    expect(screen.getByText(/already has a row this month/i)).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /balance sheet/i }),
    ).not.toBeInTheDocument();
  });

  test("a repayment may only target a liability account", async () => {
    renderSheet(unanchoredItems);
    await openAddDrawer("Repayment");
    expect(
      screen.getByRole("button", { name: "Halifax Mortgage" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Vanguard ISA" }),
    ).not.toBeInTheDocument();
  });

  // Every account seeded at onboarding is kind NONE, so a user who has never
  // touched the balance sheet has nothing eligible. An empty dropdown would
  // read as a bug.
  test("with nothing eligible, it says where accounts get a kind", async () => {
    renderSheet(items, [
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        name: "Current account",
        kind: "NONE",
        archived: false,
      },
    ]);
    await openAddDrawer("Transfer");
    expect(
      screen.getByRole("link", { name: /balance sheet/i }),
    ).toHaveAttribute("href", "/balance");
    // The sentence names what the account would be FOR, not just that none
    // exist — "no asset accounts" alone leaves the reader to work out why a
    // transfer needs one.
    expect(
      screen.getByText(/no asset accounts to transfer to or from yet/i),
    ).toBeVisible();
  });

  test("the repayment empty state says what the account would be for", async () => {
    renderSheet(items, [
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        name: "Current account",
        kind: "NONE",
        archived: false,
      },
    ]);
    await openAddDrawer("Repayment");
    expect(
      screen.getByText(/no liability accounts to repay yet/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /balance sheet/i }),
    ).toHaveAttribute("href", "/balance");
  });

  test("adding a transfer sends the anchor and defaults the label to the account", async () => {
    createItemForMonth.mockResolvedValue({
      periodId: period.id,
      item: {
        id: "5",
        type: "TRANSFER",
        category: null,
        incomeCategory: null,
        categoryId: null,
        accountId: ISA,
        direction: "OUTFLOW",
        label: "Vanguard ISA",
        budget: 0,
        actual: 0,
        sortOrder: 5,
      },
    });
    renderSheet(unanchoredItems);

    await openAddDrawer("Transfer");
    await act(async () => {
      screen.getByRole("button", { name: "Vanguard ISA" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "From Vanguard ISA" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Add" }).click();
    });

    expect(createItemForMonth).toHaveBeenCalledWith({
      year: 2026,
      month: 2,
      type: "TRANSFER",
      label: "Vanguard ISA",
      accountId: ISA,
      direction: "OUTFLOW",
    });
  });

  test("adding a repayment sends no direction — it is always money at the debt", async () => {
    createItemForMonth.mockResolvedValue({
      periodId: period.id,
      item: {
        id: "6",
        type: "REPAYMENT",
        category: null,
        incomeCategory: null,
        categoryId: null,
        accountId: MORTGAGE,
        direction: null,
        label: "Halifax Mortgage",
        budget: 0,
        actual: 0,
        sortOrder: 6,
      },
    });
    renderSheet(unanchoredItems);

    await openAddDrawer("Repayment");
    await act(async () => {
      screen.getByRole("button", { name: "Halifax Mortgage" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Add" }).click();
    });

    expect(createItemForMonth).toHaveBeenCalledWith({
      year: 2026,
      month: 2,
      type: "REPAYMENT",
      label: "Halifax Mortgage",
      accountId: MORTGAGE,
      direction: null,
    });
  });
});

describe("BudgetSheet — a copy that left rows behind", () => {
  test("says how many rows were skipped rather than dropping them silently", async () => {
    listCopyablePeriods.mockResolvedValue([
      { id: "22222222-2222-2222-2222-222222222222", label: "February 2026" },
    ]);
    copyPeriodFrom.mockResolvedValue({
      periodId: period.id,
      items: [],
      skipped: 3,
    });
    renderSheet();

    await act(async () => {
      screen.getByRole("button", { name: "Fill this month from…" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "February 2026" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Fill" }).click();
    });

    expect(
      screen.getByText(
        "3 rows were skipped because their accounts could not be carried over.",
      ),
    ).toBeInTheDocument();
  });

  test("stays quiet when every row came across", async () => {
    listCopyablePeriods.mockResolvedValue([
      { id: "22222222-2222-2222-2222-222222222222", label: "February 2026" },
    ]);
    copyPeriodFrom.mockResolvedValue({
      periodId: period.id,
      items: [],
      skipped: 0,
    });
    renderSheet();

    await act(async () => {
      screen.getByRole("button", { name: "Fill this month from…" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "February 2026" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Fill" }).click();
    });

    expect(screen.queryByText(/were skipped/)).not.toBeInTheDocument();
  });
});

describe("BudgetSheet — the Add drawer's sections", () => {
  const openAdd = async () => {
    await act(async () => {
      screen.getByRole("button", { name: "+ Add" }).click();
    });
  };

  // Expense is the default kind, so its sections are on screen already —
  // choosing one is the whole gesture, with no second click on Add.
  test("clicking an expense section adds a row there, with no confirm step", async () => {
    createItemForMonth.mockResolvedValue({
      periodId: "p1",
      item: {
        id: "new-1",
        type: "EXPENSE",
        category: "DISCRETIONARY",
        incomeCategory: null,
        label: "",
        budget: 0,
        actual: 0,
        sortOrder: 9,
      },
    });
    renderSheet(items);
    await openAdd();
    await act(async () => {
      screen.getByRole("button", { name: "Discretionary" }).click();
    });

    expect(createItemForMonth).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXPENSE", category: "DISCRETIONARY" }),
    );
  });

  test("clicking an income section adds an income row there", async () => {
    createItemForMonth.mockResolvedValue({
      periodId: "p1",
      item: {
        id: "new-2",
        type: "INCOME",
        category: null,
        incomeCategory: "SIDE_INCOME",
        label: "",
        budget: 0,
        actual: 0,
        sortOrder: 9,
      },
    });
    renderSheet(items);
    await openAdd();
    await act(async () => {
      screen.getByRole("button", { name: "Income" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Side income" }).click();
    });

    expect(createItemForMonth).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "INCOME",
        incomeCategory: "SIDE_INCOME",
      }),
    );
  });

  // Repayment still needs an account, so it keeps its confirm step — the
  // section click cannot finish the job there.
  test("Repayment still asks for an account before adding", async () => {
    renderSheet(items);
    await openAdd();
    await act(async () => {
      screen.getByRole("button", { name: "Repayment" }).click();
    });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});

describe("BudgetSheet — Enter at the end of a section", () => {
  test("Enter on the last row of a bucket adds another row to that bucket", async () => {
    createItemForMonth.mockResolvedValue({
      periodId: "p1",
      item: {
        id: "new-3",
        type: "EXPENSE",
        category: "FIXED",
        incomeCategory: null,
        label: "",
        budget: 0,
        actual: 0,
        sortOrder: 9,
      },
    });
    // "Housing" is the only FIXED expense in the fixture, so it is the last
    // row of its bucket — which is where Enter adds rather than moves.
    renderSheet(items);
    const cell = screen.getByDisplayValue("Housing");
    const row = cell.closest("[role='row']");
    const budget = row?.querySelectorAll("input")[1];
    if (!budget) throw new Error("no budget cell found");

    await act(async () => {
      fireEvent.keyDown(budget, { key: "Enter" });
    });

    // The new row lands in the same section as the row Enter was pressed on,
    // rather than at the default the toolbar would have used.
    expect(createItemForMonth).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXPENSE" }),
    );
  });
});

describe("BudgetSheet — untouched rows", () => {
  const focusLabel = async (value: string) => {
    await act(async () => {
      fireEvent.focus(screen.getByDisplayValue(value));
    });
  };

  // A named row budgeted at zero is a real answer: it exists, it reaches the
  // plan, and there may be contributions to it later. Only a row nobody typed
  // into at all is swept up.
  test("keeps a named row budgeted at zero when focus leaves it", async () => {
    renderSheet([
      row({ id: "z", label: "Sinking fund", budget: 0, actual: 0 }),
      row({ id: "y", label: "Housing", budget: 2200, actual: 2000 }),
    ]);
    await focusLabel("Sinking fund");
    await focusLabel("Housing");

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Sinking fund")).toBeInTheDocument();
  });

  test("removes a row with no label and no amounts once focus leaves", async () => {
    renderSheet([
      row({ id: "blank", label: "", budget: 0, actual: 0 }),
      row({ id: "y", label: "Housing", budget: 2200, actual: 2000 }),
    ]);
    await act(async () => {
      fireEvent.focus(
        screen.getAllByPlaceholderText("Name this row")[0] as HTMLElement,
      );
    });
    await focusLabel("Housing");

    expect(deleteItem).toHaveBeenCalledWith({ itemId: "blank" });
  });
});

describe("BudgetSheet — adding an account from the transfer picker", () => {
  // The account you want to transfer to may not exist yet. Leaving for the
  // balance sheet loses the row you were part-way through adding, so the same
  // drawer the balance sheet uses opens here.
  test("offers a new account alongside the eligible ones", async () => {
    renderSheet(unanchoredItems);
    await act(async () => {
      screen.getByRole("button", { name: "+ Add" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Transfer" }).click();
    });

    expect(
      screen.getByRole("button", { name: "+ New account…" }),
    ).toBeVisible();
  });
});

describe("BudgetSheet — arrow navigation", () => {
  const cellsOf = (label: string) => {
    const row = screen.getByDisplayValue(label).closest("[role='row']");
    if (!row) throw new Error(`no row for ${label}`);
    return row.querySelectorAll("input");
  };

  test("up and down step rows in the same column", () => {
    renderSheet(items);
    const housingBudget = cellsOf("Housing")[1] as HTMLInputElement;
    const salaryBudget = cellsOf("Salary")[1] as HTMLInputElement;

    housingBudget.focus();
    fireEvent.keyDown(housingBudget, { key: "ArrowUp" });
    expect(document.activeElement).toBe(salaryBudget);

    fireEvent.keyDown(salaryBudget, { key: "ArrowDown" });
    expect(document.activeElement).toBe(housingBudget);
  });

  // The caret has to keep working inside a value: these cells restore it by
  // hand after regrouping thousands separators, so hijacking left/right
  // outright would make a number uneditable in the middle.
  test("left and right move the caret mid-value, and only step columns at the edge", () => {
    renderSheet(items);
    const cells = cellsOf("Housing");
    const label = cells[0] as HTMLInputElement;
    const budget = cells[1] as HTMLInputElement;

    // Caret parked mid-word: the arrow belongs to the text, not the grid.
    label.focus();
    label.setSelectionRange(3, 3);
    fireEvent.keyDown(label, { key: "ArrowRight" });
    expect(document.activeElement).toBe(label);

    // At the end of the value, it steps to the next column.
    label.setSelectionRange(label.value.length, label.value.length);
    fireEvent.keyDown(label, { key: "ArrowRight" });
    expect(document.activeElement).toBe(budget);

    // And back again from the start of that one.
    budget.setSelectionRange(0, 0);
    fireEvent.keyDown(budget, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(label);
  });

  test("stops at the first column rather than wrapping", () => {
    renderSheet(items);
    const label = cellsOf("Housing")[0] as HTMLInputElement;
    label.focus();
    label.setSelectionRange(0, 0);
    fireEvent.keyDown(label, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(label);
  });
});

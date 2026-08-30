// src/__tests__/balance/BalanceSheet.test.tsx
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  BalanceSheet,
  type SerializedAccountRow,
  type SerializedPeriod,
} from "@/app/(app)/balance/BalanceSheet";
import { accountTypesOfKind } from "@/lib/accounts/accountDraft";
import { formatAmount } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh }),
}));

const upsertBalanceValue = jest.fn();
const clearBalanceValue = jest.fn();
jest.mock("@/app/(app)/balance/actions", () => ({
  clearBalanceValue: (...args: unknown[]) => clearBalanceValue(...args),
  copyBalancePeriodFrom: jest.fn(),
  listCopyableBalancePeriods: jest.fn().mockResolvedValue([]),
  upsertBalanceValue: (...args: unknown[]) => upsertBalanceValue(...args),
}));

const accountDeletionCounts = jest.fn();
const setAccountType = jest.fn();
const setAccountSection = jest.fn();
const renameAccount = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  accountDeletionCounts: (...args: unknown[]) => accountDeletionCounts(...args),
  createAccount: jest.fn(),
  renameAccount: (...args: unknown[]) => renameAccount(...args),
  setAccountSection: (...args: unknown[]) => setAccountSection(...args),
  setAccountType: (...args: unknown[]) => setAccountType(...args),
}));

const period: SerializedPeriod = {
  id: "11111111-1111-1111-1111-111111111111",
  label: "March 2026",
  startDate: "2026-03-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
};

const baseRow: SerializedAccountRow = {
  accountId: "22222222-2222-2222-2222-222222222222",
  name: "Current account",
  type: "CURRENT_ACCOUNT",
  kind: "ASSET",
  section: "CURRENT",
  sortOrder: 1,
  value: 100,
  notes: null,
  carriedOver: false,
};

const renderSheet = (rows: SerializedAccountRow[]) =>
  render(
    <ThemeProvider theme={theme}>
      <BalanceSheet
        period={period}
        initialRows={rows}
        year={2026}
        month={2}
        currency="GBP"
        numberFormat="COMMA_0"
      />
    </ThemeProvider>,
  );

describe("BalanceSheet — refresh adoption vs. an unsaved edit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Never resolves within this test — the debounce that would call it is
    // never allowed to fire (fake timers, never advanced).
    upsertBalanceValue.mockReset();
    upsertBalanceValue.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The bug this pins: editField applies the optimistic edit and schedules
  // a 500ms-debounced write; pendingSavesRef only increments once that
  // timer fires. A router.refresh() landing during the debounce window
  // (simulated here as a rerender with the server's still-stale
  // initialRows) must not let the "adopt fresh server data" effect
  // clobber the edit that's still waiting to be sent.
  test("an edit mid-debounce survives a refresh that lands with stale props", () => {
    const { rerender } = renderSheet([baseRow]);

    const amountInput = screen.getByPlaceholderText("0") as HTMLInputElement;
    fireEvent.focus(amountInput);
    fireEvent.change(amountInput, { target: { value: "200" } });
    fireEvent.blur(amountInput);

    // Debounce timer is still pending — jest.useFakeTimers() means it
    // genuinely has not fired. A refresh lands anyway, with the server's
    // pre-write snapshot (value still 100).
    rerender(
      <ThemeProvider theme={theme}>
        <BalanceSheet
          period={period}
          initialRows={[{ ...baseRow, value: 100 }]}
          year={2026}
          month={2}
          currency="GBP"
          numberFormat="COMMA_0"
        />
      </ThemeProvider>,
    );

    expect(amountInput.value).toBe(formatAmount("GBP", 200, "COMMA_0"));
  });
});

describe("BalanceSheet — dirty tracking is per item, not one shared flag", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    upsertBalanceValue.mockReset();
    upsertBalanceValue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The bug this pins: a single boolean "something is dirty" flag is cleared
  // unconditionally the instant *any* item's debounced save starts — even
  // while a second item, edited moments later, is still sitting in its own
  // (separately keyed) debounce timer. Once that happens, a refresh landing
  // before the second item's timer fires sees "dirty: false, nothing
  // pending" and silently overwrites the second item's still-unsaved
  // optimistic value with the server's stale snapshot.
  test("editing a second cell shortly after the first survives a refresh landing once the first save completes", async () => {
    const rowA: SerializedAccountRow = {
      ...baseRow,
      accountId: "account-a",
      name: "Current account",
      value: 100,
      sortOrder: 1,
    };
    const rowB: SerializedAccountRow = {
      ...baseRow,
      accountId: "account-b",
      name: "Savings",
      value: 50,
      sortOrder: 2,
    };
    const { rerender } = renderSheet([rowA, rowB]);

    const amountInputs = screen.getAllByPlaceholderText(
      "0",
    ) as HTMLInputElement[];
    const inputA = amountInputs[0];
    const inputB = amountInputs[1];
    if (!inputA || !inputB) throw new Error("expected two amount inputs");

    // Edit A.
    fireEvent.focus(inputA);
    fireEvent.change(inputA, { target: { value: "200" } });
    fireEvent.blur(inputA);

    // 100ms later — still inside A's 500ms debounce window — edit B too.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    fireEvent.focus(inputB);
    fireEvent.change(inputB, { target: { value: "999" } });
    fireEvent.blur(inputB);

    // Advance to A's 500ms mark (started at t=0): A's debounced save fires
    // and completes. B's own timer (started at t=100) has 100ms left — it
    // has not fired, so B's edit is still only optimistic.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(upsertBalanceValue).toHaveBeenCalledTimes(1);
    expect(upsertBalanceValue).toHaveBeenCalledWith({
      accountId: "account-a",
      year: 2026,
      month: 2,
      value: 200,
    });

    // A refresh lands right now — e.g. router.refresh() from an unrelated
    // action — carrying the server's pre-edit snapshot for both rows.
    rerender(
      <ThemeProvider theme={theme}>
        <BalanceSheet
          period={period}
          initialRows={[rowA, rowB]}
          year={2026}
          month={2}
          currency="GBP"
          numberFormat="COMMA_0"
        />
      </ThemeProvider>,
    );

    // Both edits must still be showing — B's save hasn't landed yet, and
    // wiping A's display would disagree with what was just successfully
    // saved for it.
    expect(inputA.value).toBe(formatAmount("GBP", 200, "COMMA_0"));
    expect(inputB.value).toBe(formatAmount("GBP", 999, "COMMA_0"));
  });
});

describe("BalanceSheet — an account with no value this month", () => {
  // The whole point of listing accounts rather than rows: an account the
  // user hasn't got to yet still has a line, with an empty cell to type
  // into. A zero would be a number they never gave.
  test("renders an empty cell and says how many accounts are waiting", () => {
    renderSheet([{ ...baseRow, value: null }]);

    const amountInput = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(amountInput.value).toBe("");
    expect(screen.getByText("1 account without a value")).toBeInTheDocument();
  });

  // A note describes this month's figure. With no figure there is no row to
  // hang it on, and saving one would invent a £0 the user never typed — so
  // the notes cell waits rather than letting them type into a dead end.
  test("the notes cell waits for a value", () => {
    upsertBalanceValue.mockReset();
    renderSheet([{ ...baseRow, value: null }]);

    const notes = screen.getByPlaceholderText(
      "Enter a value first",
    ) as HTMLInputElement;
    expect(notes).toBeDisabled();

    fireEvent.change(notes, { target: { value: "Chase the statement" } });
    expect(upsertBalanceValue).not.toHaveBeenCalled();
  });

  test("the notes cell opens up once the row has a value", () => {
    renderSheet([baseRow]);

    expect(screen.getByPlaceholderText("Notes (optional)")).toBeEnabled();
  });

  test("counts every account still without one", () => {
    renderSheet([
      { ...baseRow, value: null },
      { ...baseRow, accountId: "account-b", name: "Savings", value: null },
      { ...baseRow, accountId: "account-c", name: "ISA", value: 12 },
    ]);

    expect(screen.getByText("2 accounts without a value")).toBeInTheDocument();
  });
});

describe("BalanceSheet — the row's type control", () => {
  beforeEach(() => {
    setAccountType.mockReset();
    setAccountType.mockResolvedValue(undefined);
  });

  // Same kind only: an account never crosses between assets and liabilities
  // (setAccountType refuses it), so the list is the nine asset types and
  // nothing else.
  test("an asset row offers exactly the nine asset types", () => {
    renderSheet([baseRow]);
    fireEvent.focus(screen.getByDisplayValue(baseRow.name));

    const select = screen.getByLabelText("Account type") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(
      accountTypesOfKind("ASSET").map((t) => t.label),
    );
    expect(select.options).toHaveLength(9);
  });

  test("picking a type saves it against the account", async () => {
    renderSheet([baseRow]);
    fireEvent.focus(screen.getByDisplayValue(baseRow.name));

    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "SAVINGS" },
    });

    await waitFor(() =>
      expect(setAccountType).toHaveBeenCalledWith({
        accountId: baseRow.accountId,
        type: "SAVINGS",
      }),
    );
  });

  // A refusal names the blocker — a linked mortgage, a plan sale event — and
  // that sentence is the only thing telling the user what to deal with
  // first, so it is shown as written rather than as "Save failed".
  test("a refusal is shown in the sheet's error slot, verbatim", async () => {
    setAccountType.mockRejectedValue(
      new Error("Home is linked to its mortgage/property — unlink first"),
    );
    renderSheet([baseRow]);
    fireEvent.focus(screen.getByDisplayValue(baseRow.name));

    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "SAVINGS" },
    });

    expect(
      await screen.findByText(
        "Home is linked to its mortgage/property — unlink first",
      ),
    ).toBeInTheDocument();
  });
});

describe("BalanceSheet — deleting a row", () => {
  beforeEach(() => {
    accountDeletionCounts.mockClear();
  });

  // Every row is an account now, so the delete gesture always goes through
  // the counts-then-confirm panel — the one hard delete in the app never
  // happens without the size of what it removes stated up front.
  test("opens the delete panel with the account's counts", async () => {
    accountDeletionCounts.mockResolvedValue({
      months: 3,
      budgetRows: 1,
      transactions: 0,
      importBatches: 0,
      linked: null,
    });
    renderSheet([baseRow]);

    fireEvent.focus(screen.getByDisplayValue(baseRow.name));
    fireEvent.click(screen.getByRole("button", { name: /delete row/i }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(accountDeletionCounts).toHaveBeenCalledWith({
      accountId: baseRow.accountId,
    });
  });
});

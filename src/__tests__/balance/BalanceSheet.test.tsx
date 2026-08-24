// src/__tests__/balance/BalanceSheet.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import {
  BalanceSheet,
  type SerializedBalanceItem,
  type SerializedPeriod,
} from "@/app/(app)/balance/BalanceSheet";
import { formatAmount } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh }),
}));

const deleteBalanceItem = jest.fn();
jest.mock("@/app/(app)/balance/actions", () => ({
  copyBalancePeriodFrom: jest.fn(),
  copyBalanceTemplateInto: jest.fn(),
  deleteBalanceItem: (...args: unknown[]) => deleteBalanceItem(...args),
  listCopyableBalancePeriods: jest.fn().mockResolvedValue([]),
  moveBalanceItem: jest.fn(),
  saveBalanceTemplate: jest.fn(),
  setBalanceItemSection: jest.fn(),
  // Never resolves within this test — the debounce that would call it is
  // never allowed to fire (fake timers, never advanced).
  updateBalanceItem: jest.fn(() => new Promise(() => {})),
}));

const accountDeletionCounts = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  createAccountWithBalance: jest.fn(),
  accountDeletionCounts: (...args: unknown[]) => accountDeletionCounts(...args),
}));

const period: SerializedPeriod = {
  id: "11111111-1111-1111-1111-111111111111",
  label: "March 2026",
  startDate: "2026-03-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
};

const baseItem: SerializedBalanceItem = {
  id: "22222222-2222-2222-2222-222222222222",
  type: "ASSET",
  category: "CURRENT",
  label: "Current account",
  value: 100,
  notes: null,
  sortOrder: 1,
  carriedOver: false,
};

const renderSheet = (items: SerializedBalanceItem[]) =>
  render(
    <ThemeProvider theme={theme}>
      <BalanceSheet
        period={period}
        initialItems={items}
        year={2026}
        month={2}
        currency="GBP"
        numberFormat="COMMA_0"
        hasTemplate={false}
      />
    </ThemeProvider>,
  );

describe("BalanceSheet — refresh adoption vs. an unsaved edit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The bug this pins: editField applies the optimistic edit and schedules
  // a 500ms-debounced write; pendingSavesRef only increments once that
  // timer fires. A router.refresh() landing during the debounce window
  // (simulated here as a rerender with the server's still-stale
  // initialItems) must not let the "adopt fresh server data" effect
  // clobber the edit that's still waiting to be sent.
  test("an edit mid-debounce survives a refresh that lands with stale props", () => {
    const { rerender } = renderSheet([baseItem]);

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
          initialItems={[{ ...baseItem, value: 100 }]}
          year={2026}
          month={2}
          currency="GBP"
          numberFormat="COMMA_0"
          hasTemplate={false}
        />
      </ThemeProvider>,
    );

    expect(amountInput.value).toBe(formatAmount("GBP", 200, "COMMA_0"));
  });
});

describe("BalanceSheet — onDelete branches on accountId", () => {
  beforeEach(() => {
    deleteBalanceItem.mockClear();
    accountDeletionCounts.mockClear();
  });

  // The hard risk this pins: a row backed by a durable Account must go
  // through the counts-then-confirm panel, never straight to
  // deleteBalanceItem — that path skips the "how much history does this
  // remove" step entirely.
  test("a row with an accountId opens the delete panel instead of deleting directly", async () => {
    accountDeletionCounts.mockResolvedValue({
      months: 3,
      budgetRows: 1,
      transactions: 0,
      importBatches: 0,
      linked: null,
    });
    const item: SerializedBalanceItem = { ...baseItem, accountId: "account-1" };
    renderSheet([item]);

    fireEvent.focus(screen.getByDisplayValue(item.label));
    fireEvent.click(screen.getByRole("button", { name: /delete row/i }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(accountDeletionCounts).toHaveBeenCalledWith({
      accountId: "account-1",
    });
    expect(deleteBalanceItem).not.toHaveBeenCalled();
  });

  // The other hard risk: a legacy row that predates the backfill (no
  // accountId at all) must keep the old direct-delete path — it must never
  // reach the panel, which would fetch counts for an account that doesn't
  // exist.
  test("a legacy row with no accountId still deletes directly, bypassing the panel", async () => {
    renderSheet([baseItem]);

    fireEvent.focus(screen.getByDisplayValue(baseItem.label));
    fireEvent.click(screen.getByRole("button", { name: /delete row/i }));

    await waitFor(() =>
      expect(deleteBalanceItem).toHaveBeenCalledWith({ itemId: baseItem.id }),
    );
    expect(accountDeletionCounts).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { AccountManager } from "@/app/(app)/settings/AccountManager";
import { theme } from "@/lib/theme";

const restore = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  restoreAccount: (...a: unknown[]) => restore(...a),
}));

// Stubbed out so the year/month AccountManager resolves for "this month" can
// be asserted directly, without depending on the real drawer's own rendering.
const addAccountDrawerProps = jest.fn();
jest.mock("@/app/(app)/balance/AddAccountDrawer", () => ({
  AddAccountDrawer: (props: unknown) => {
    addAccountDrawerProps(props);
    return null;
  },
}));

const setImports = jest.fn();
jest.mock("@/app/(app)/settings/accountActions", () => ({
  deleteAccount: jest.fn(),
  renameAccount: jest.fn(),
  setAccountImports: (...a: unknown[]) => setImports(...a),
}));

// useRouter() throws without an app-router context under jsdom — provide a stub.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

describe("AccountManager", () => {
  // The user's own example: plenty of mortgage providers issue statements, and
  // someone who wants that ledger should be able to switch it on.
  test("toggles whether statements can be imported to an account", async () => {
    render(
      <ThemeProvider theme={theme}>
        <AccountManager
          accounts={[
            {
              id: "a1",
              name: "Halifax mortgage",
              type: "MORTGAGE",
              ownedCount: 0,
              counterpartyCount: 0,
              canImportTransactions: false,
            },
          ]}
          archived={[]}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Mortgage")).toBeInTheDocument();

    const toggle = screen.getByRole("checkbox", {
      name: /allow importing of statements/i,
    });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(setImports).toHaveBeenCalledWith({
        accountId: "a1",
        enabled: true,
      }),
    );
  });

  test("lists archived accounts separately and restores one", async () => {
    render(
      <ThemeProvider theme={theme}>
        <AccountManager
          accounts={[
            {
              id: "a1",
              name: "Barclays Current",
              type: "CURRENT_ACCOUNT",
              ownedCount: 0,
              counterpartyCount: 0,
            },
          ]}
          archived={[{ id: "a2", name: "Old ISA" }]}
        />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /archived/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Old ISA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restore/i }));
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith({ accountId: "a2" }),
    );
  });

  test("renders nothing for an empty archive", () => {
    render(
      <ThemeProvider theme={theme}>
        <AccountManager
          accounts={[
            {
              id: "a1",
              name: "Barclays Current",
              type: "CURRENT_ACCOUNT",
              ownedCount: 0,
              counterpartyCount: 0,
            },
          ]}
          archived={[]}
        />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole("heading", { name: /archived/i }),
    ).not.toBeInTheDocument();
  });

  // BalanceSheet.tsx/BudgetSheet.tsx both resolve "today" with the UTC
  // getters, matching currentMonthRange() server-side. Pins the system clock
  // to 2026-02-01T04:30:00Z (2026-01-31T23:30:00-05:00 — the boundary a
  // negative-UTC-offset user hits near month-end) and poisons the *local*
  // getters with an obviously wrong year/month, so the assertion can only
  // pass if the component reads the UTC ones.
  test("resolves the new-account month from UTC, not local time", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-01T04:30:00.000Z"));
    const yearSpy = jest
      .spyOn(Date.prototype, "getFullYear")
      .mockReturnValue(1999);
    const monthSpy = jest.spyOn(Date.prototype, "getMonth").mockReturnValue(0);

    try {
      render(
        <ThemeProvider theme={theme}>
          <AccountManager accounts={[]} archived={[]} />
        </ThemeProvider>,
      );

      expect(addAccountDrawerProps).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2026, month: 1 }),
      );
    } finally {
      yearSpy.mockRestore();
      monthSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { AccountManager } from "@/app/(app)/settings/AccountManager";
import { theme } from "@/lib/theme";

const restore = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  restoreAccount: (...a: unknown[]) => restore(...a),
}));

const setImports = jest.fn();
jest.mock("@/app/(app)/settings/accountActions", () => ({
  createManagedAccount: jest.fn(),
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
              ownedCount: 0,
              counterpartyCount: 0,
              canImportTransactions: false,
            },
          ]}
          archived={[]}
        />
      </ThemeProvider>,
    );

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
});

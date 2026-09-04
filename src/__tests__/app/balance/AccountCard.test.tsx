import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { AccountCard } from "@/app/(app)/balance/AccountCard";
import { theme } from "@/lib/theme";

jest.mock("@/app/(app)/balance/accountActions", () => ({
  renameAccount: jest.fn().mockResolvedValue(undefined),
  setAccountType: jest.fn().mockResolvedValue(undefined),
  setAccountSection: jest.fn().mockResolvedValue(undefined),
  setAccountTerms: jest.fn().mockResolvedValue(undefined),
}));

// Every styled component the card renders (via the shared Drawer) reads its
// colours from styled-components' theme context — every other test in the
// repo that touches Drawer/EditableCell wraps with the same ThemeProvider
// (AddAccountDrawer.test.tsx, AccountTermsFields.test.tsx, Drawer.test.tsx),
// so this does the same rather than rendering unthemed.
const renderCard = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const mortgage = {
  id: "a3",
  name: "Barclays mortgage",
  type: "MORTGAGE" as const,
  section: "PROPERTY" as const,
  kind: "LIABILITY" as const,
  terms: { interestPct: 4.29 },
};

describe("AccountCard", () => {
  it("shows the name, type, section and the type's terms", () => {
    renderCard(
      <AccountCard
        open
        account={mortgage}
        onClose={() => {}}
        onError={() => {}}
      />,
    );

    expect(screen.getByDisplayValue("Barclays mortgage")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Section")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4.29")).toBeInTheDocument();
  });

  it("commits a rename on blur", async () => {
    const { renameAccount } = require("@/app/(app)/balance/accountActions");
    renderCard(
      <AccountCard
        open
        account={mortgage}
        onClose={() => {}}
        onError={() => {}}
      />,
    );

    const name = screen.getByDisplayValue("Barclays mortgage");
    await userEvent.clear(name);
    await userEvent.type(name, "Halifax mortgage");
    await userEvent.tab();

    expect(renameAccount).toHaveBeenCalledWith({
      accountId: "a3",
      name: "Halifax mortgage",
    });
  });

  it("offers only the types of the row's own kind", () => {
    renderCard(
      <AccountCard
        open
        account={mortgage}
        onClose={() => {}}
        onError={() => {}}
      />,
    );

    const select = screen.getByLabelText("Type");
    expect(select).toHaveDisplayValue("Mortgage");
    // Sync keys plan rows on kind::accountId, so a liability may not become an
    // asset — the server refuses it and the card must not offer it.
    expect(
      screen.queryByRole("option", { name: "Stocks & shares ISA" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces the server's own sentence when a type change is refused", async () => {
    const actions = require("@/app/(app)/balance/accountActions");
    actions.setAccountType.mockRejectedValueOnce(
      new Error("Change the mortgage on Home first"),
    );
    renderCard(
      <AccountCard
        open
        account={mortgage}
        onClose={() => {}}
        onError={() => {}}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Type"), "LOAN");

    expect(
      await screen.findByText("Change the mortgage on Home first"),
    ).toBeInTheDocument();
  });
});

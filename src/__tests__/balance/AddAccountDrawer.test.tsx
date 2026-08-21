// src/__tests__/balance/AddAccountDrawer.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { AddAccountDrawer } from "@/app/(app)/balance/AddAccountDrawer";
import { theme } from "@/lib/theme";

const created = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  createAccountWithBalance: (...args: unknown[]) => created(...args),
}));

const renderDrawer = () =>
  render(
    <ThemeProvider theme={theme}>
      <AddAccountDrawer
        open
        year={2026}
        month={2}
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />
    </ThemeProvider>,
  );

describe("AddAccountDrawer", () => {
  // Order-independence: the "clears the draft on cancel" test below asserts
  // created was NOT called, which would false-fail if it ran after the
  // "submits the account..." test's real call without this reset.
  beforeEach(() => {
    created.mockClear();
  });

  test("asks what is being added before anything else", () => {
    renderDrawer();
    expect(screen.getByRole("radio", { name: /asset/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /liability/i }),
    ).toBeInTheDocument();
  });

  // The mortgage branch is the reason the drawer exists rather than a text
  // field: a property with a debt on it is two accounts and a link.
  test("offers a mortgage only for a property", () => {
    renderDrawer();
    expect(screen.queryByLabelText(/mortgage/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "PROPERTY" },
    });

    expect(screen.getByLabelText(/is there a mortgage/i)).toBeInTheDocument();
  });

  test("defaults canImportTransactions off for a liability and on for an asset", () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    expect(screen.getByLabelText(/import statements/i)).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /liability/i }));
    expect(screen.getByLabelText(/import statements/i)).not.toBeChecked();
  });

  // Decided by the user: nothing may default into Other.
  test("will not submit until a section is chosen", () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Premium bonds" },
    });
    fireEvent.change(screen.getByLabelText(/value now/i), {
      target: { value: "5000" },
    });

    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "MEDIUM_TERM" },
    });
    expect(screen.getByRole("button", { name: /^add$/i })).toBeEnabled();
  });

  test("submits the account and its opening value together", async () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Vanguard ISA" },
    });
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "LONG_TERM" },
    });
    fireEvent.change(screen.getByLabelText(/wrapper/i), {
      target: { value: "ISA" },
    });
    fireEvent.change(screen.getByLabelText(/value now/i), {
      target: { value: "42300" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 2026,
        month: 2,
        name: "Vanguard ISA",
        type: "ASSET",
        category: "LONG_TERM",
        wrapper: "ISA",
        value: 42300,
        mortgage: null,
      }),
    );
  });

  // Wiring check for resolveCanImportTransactions (unit-tested exhaustively
  // in accountDraft.test.ts): once the user has touched the checkbox
  // directly, a later type/section change must not revert it back to that
  // combination's fresh default.
  test("a manual override of Import statements survives later type and section changes", () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    expect(screen.getByLabelText(/import statements/i)).toBeChecked();

    // Touch it: asset's fresh default is on, so switch it off.
    fireEvent.click(screen.getByLabelText(/import statements/i));
    expect(screen.getByLabelText(/import statements/i)).not.toBeChecked();

    // Liability's fresh default is also off — bounce through it and back to
    // asset, whose fresh default is on, to prove the override (not a
    // coincidental match) is what's holding it unchecked.
    fireEvent.click(screen.getByRole("radio", { name: /liability/i }));
    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    expect(screen.getByLabelText(/import statements/i)).not.toBeChecked();
  });

  // Regression test for a fix reviewed in round 1: closing without
  // submitting must clear the draft, not just hide it.
  test("clears the draft on cancel, without submitting", () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("radio", { name: /asset/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Draft I will abandon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });
});

// src/__tests__/balance/AddAccountDrawer.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
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

// One picker now sets both kind and wrapper (see ACCOUNT_TYPES), so tests
// choose a concrete thing — "Stocks & shares ISA" — rather than an abstract
// Asset/Liability.
const pickType = (value: string) =>
  fireEvent.change(screen.getByLabelText(/what are you adding/i), {
    target: { value },
  });

describe("AddAccountDrawer", () => {
  // Order-independence: the "clears the draft on cancel" test below asserts
  // created was NOT called, which would false-fail if it ran after the
  // "submits the account..." test's real call without this reset.
  beforeEach(() => {
    created.mockClear();
  });

  test("asks what is being added before anything else", () => {
    renderDrawer();
    expect(screen.getByLabelText(/what are you adding/i)).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Mortgage" }),
    ).toBeInTheDocument();
  });

  // The mortgage branch is the reason the drawer exists rather than a text
  // field: a property with a debt on it is two accounts and a link. It keys
  // off choosing Property as the type, not off the section — someone may file
  // a property under a section other than Property.
  test("offers a mortgage only for a property", () => {
    renderDrawer();
    expect(screen.queryByLabelText(/mortgage/i)).not.toBeInTheDocument();

    pickType("STOCKS_ISA");
    expect(
      screen.queryByLabelText(/is there a mortgage/i),
    ).not.toBeInTheDocument();

    pickType("PROPERTY");
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "PROPERTY" },
    });

    expect(screen.getByLabelText(/is there a mortgage/i)).toBeInTheDocument();
  });

  // Whether a SIPP can take a CSV is not a decision worth making while naming
  // one, and the answer is the same for everyone with that type. The drawer
  // no longer asks; Settings lists every account with its own switch for the
  // rare case where the default is wrong.
  test("does not ask about statement imports", () => {
    renderDrawer();
    pickType("STOCKS_ISA");
    expect(
      screen.queryByLabelText(/allow importing of statements/i),
    ).not.toBeInTheDocument();
  });

  // The section follows the type as a default the user can override — a final
  // salary pension is long-term, a credit card is current. Not an inference:
  // the dropdown stays, and a choice the user makes survives a later type
  // change.
  test("the section is pre-selected from the chosen type", () => {
    renderDrawer();

    pickType("FINAL_SALARY");
    expect(screen.getByLabelText(/section/i)).toHaveValue("LONG_TERM");

    pickType("CREDIT_CARD");
    expect(screen.getByLabelText(/section/i)).toHaveValue("CURRENT");
  });

  test("a section the user picks survives a later type change", () => {
    renderDrawer();

    pickType("SAVINGS");
    expect(screen.getByLabelText(/section/i)).toHaveValue("MEDIUM_TERM");

    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "CURRENT" },
    });
    pickType("GIA");
    expect(screen.getByLabelText(/section/i)).toHaveValue("CURRENT");
  });

  // PROPERTY is asset-only, so a user-chosen section that a later type cannot
  // accept falls back to that type's default rather than staying invalid.
  test("an invalid user choice falls back to the new type's default", () => {
    renderDrawer();

    pickType("PROPERTY");
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "PROPERTY" },
    });

    pickType("CREDIT_CARD");
    expect(screen.getByLabelText(/section/i)).toHaveValue("CURRENT");
  });

  test("a liability choice yields kind LIABILITY and no wrapper", async () => {
    renderDrawer();

    pickType("MORTGAGE");
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Halifax mortgage" },
    });
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "LONG_TERM" },
    });
    fireEvent.change(screen.getByLabelText(/value now/i), {
      target: { value: "184200" },
    });
    // The submit handler is async — awaiting it inside act keeps the pending
    // state transition from landing after the test ends.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    });

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Halifax mortgage",
        type: "LIABILITY",
        category: "LONG_TERM",
        mortgage: null,
      }),
    );
  });

  // Picking a type must not offer a mortgage branch for a liability, and the
  // name placeholder should follow the choice.
  test("the name placeholder follows the chosen type", () => {
    renderDrawer();

    pickType("SIPP");
    expect(screen.getByLabelText(/name/i)).toHaveAttribute(
      "placeholder",
      "e.g. AJ Bell SIPP",
    );

    pickType("CREDIT_CARD");
    expect(screen.getByLabelText(/name/i)).toHaveAttribute(
      "placeholder",
      "e.g. Amex",
    );
  });

  test("submits the account and its opening value together", async () => {
    renderDrawer();

    pickType("STOCKS_ISA");
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Vanguard ISA" },
    });
    fireEvent.change(screen.getByLabelText(/section/i), {
      target: { value: "LONG_TERM" },
    });
    fireEvent.change(screen.getByLabelText(/value now/i), {
      target: { value: "42300" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    });

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

  // Regression test for a fix reviewed in round 1: closing without
  // submitting must clear the draft, not just hide it.
  test("clears the draft on cancel, without submitting", () => {
    renderDrawer();

    pickType("STOCKS_ISA");
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Draft I will abandon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });
});

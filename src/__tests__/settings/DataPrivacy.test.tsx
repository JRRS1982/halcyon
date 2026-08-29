import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { DataPrivacy } from "@/app/(app)/settings/DataPrivacy";
import { theme } from "@/lib/theme";

const resetToDefaults = jest.fn(async () => undefined);
jest.mock("@/app/(app)/settings/dataActions", () => ({
  exportMyData: jest.fn(async () => "{}"),
  clearMyData: jest.fn(async () => undefined),
  deleteMyAccount: jest.fn(async () => undefined),
  resetToDefaults: () => resetToDefaults(),
}));

// useRouter() throws without an app-router context under jsdom — provide a stub.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <DataPrivacy />
    </ThemeProvider>,
  );

describe("DataPrivacy", () => {
  test("renders the three controls", () => {
    renderit();
    expect(
      screen.getByRole("button", { name: /export my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  test("clear opens an in-app warning with confirm + cancel (no native confirm)", () => {
    renderit();
    // No confirmation panel until the user starts the flow.
    expect(
      screen.queryByText(/delete all financial records/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear my data/i }));

    expect(
      screen.getByText(/delete all financial records/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

    // Cancelling dismisses the warning.
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(
      screen.queryByText(/delete all financial records/i),
    ).not.toBeInTheDocument();
  });

  test("delete requires a confirmation step, then typing DELETE", () => {
    renderit();
    // The confirm field is hidden until the user opens the confirmation step.
    expect(
      screen.queryByPlaceholderText(/type DELETE/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    const input = screen.getByPlaceholderText(/type DELETE/i);
    expect(input).toBeInTheDocument();

    // With the step open, the confirm button is the only "Delete my account"
    // button, and it's disabled until DELETE is typed exactly.
    const confirm = screen.getByRole("button", { name: /delete my account/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirm).toBeEnabled();
  });
});

describe("DataPrivacy — reset to defaults", () => {
  // This button called window.open("reset") for a while: the local handler is
  // named `start`, `open` is a global with a compatible signature, and
  // TypeScript was perfectly happy. It navigated to a page called "reset"
  // instead of asking anything, which no type or lint rule would have caught.
  test("asks for confirmation rather than navigating", () => {
    renderit();
    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    expect(
      screen.getByRole("alertdialog", { name: /confirm reset to defaults/i }),
    ).toBeInTheDocument();
    expect(resetToDefaults).not.toHaveBeenCalled();
  });

  test("runs the reset once confirmed", () => {
    renderit();
    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));
    const dialog = screen.getByRole("alertdialog", {
      name: /confirm reset to defaults/i,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /reset to defaults/i }),
    );

    expect(resetToDefaults).toHaveBeenCalledTimes(1);
  });
});

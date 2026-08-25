import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { SyncRemovalDialog } from "@/app/(app)/plan/SyncRemovalDialog";
import { theme } from "@/lib/theme";

const removals = [
  { id: "p1", label: "Buy-to-let at 50", reason: "plan-only" as const },
];

const renderDialog = (props = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <SyncRemovalDialog
        removals={removals}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe("SyncRemovalDialog", () => {
  // Naming the rows lets the user see whether what's going is scratch work or
  // an evening's scenario. A count alone cannot.
  test("names each row it will remove", () => {
    renderDialog();
    expect(screen.getByText("Buy-to-let at 50")).toBeInTheDocument();
  });

  test("says how many, in the heading", () => {
    renderDialog();
    expect(
      screen.getByRole("alertdialog", { name: /remove 1 plan-only row/i }),
    ).toBeInTheDocument();
  });

  test("cancel does not sync", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderDialog({ onConfirm, onCancel });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("confirming proceeds", () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByRole("button", { name: /sync anyway/i }));

    expect(onConfirm).toHaveBeenCalled();
  });
});

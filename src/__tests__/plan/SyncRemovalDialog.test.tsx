import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { SyncRemovalDialog } from "@/app/(app)/plan/SyncRemovalDialog";
import type { SyncRemoval } from "@/lib/plan/sync";
import { theme } from "@/lib/theme";

const removals: SyncRemoval[] = [
  {
    id: "p1",
    label: "Buy-to-let at 50",
    reason: "plan-only",
    dependsOn: null,
  },
];

// A property whose account was archived, and everything that cannot outlive
// it. The property itself is a "gone" row: the balance sheet's own delete
// panel already announced it, so this dialog does not name it — but what it
// drags with it has had no warning from anywhere.
const draggedByAGoneRow: SyncRemoval[] = [
  { id: "a1", label: "The house", reason: "gone", dependsOn: null },
  {
    id: "l1",
    label: "Halifax mortgage",
    reason: "cascade",
    dependsOn: "a1",
  },
  {
    id: "e1",
    label: "Sell the house at 60",
    reason: "cascade",
    dependsOn: "a1",
  },
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

  // The widened rule: a "gone" removal with no dependents still goes through
  // silently, but one that destroys a mortgage, a repayment or an evening's
  // property-sale scenario must name what it takes.
  test("names what a removal drags with it, and what it goes with", () => {
    renderDialog({ removals: draggedByAGoneRow });

    expect(screen.getByText("Halifax mortgage")).toBeInTheDocument();
    expect(screen.getByText("Sell the house at 60")).toBeInTheDocument();
    expect(screen.getAllByText("— goes with The house")).toHaveLength(2);
  });

  // The row reality lost is not named: archiving or deleting the account was
  // itself a deliberate, already-confirmed act.
  test("does not name the gone rows themselves", () => {
    renderDialog({ removals: draggedByAGoneRow });

    expect(screen.queryByText("The house")).not.toBeInTheDocument();
  });

  test("counts both kinds in the heading", () => {
    renderDialog({ removals: [...removals, ...draggedByAGoneRow] });

    expect(
      screen.getByRole("alertdialog", {
        name: /remove 1 plan-only row and 2 attached rows/i,
      }),
    ).toBeInTheDocument();
  });

  test("confirming proceeds", () => {
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByRole("button", { name: /sync anyway/i }));

    expect(onConfirm).toHaveBeenCalled();
  });
});

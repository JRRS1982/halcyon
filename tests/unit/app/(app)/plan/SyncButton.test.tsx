import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { SyncButton } from "@/app/(app)/plan/SyncButton";
import { emptyRowTerms } from "@/lib/plan/rowTerms";
import type { SyncPlan } from "@/lib/plan/sync";
import { theme } from "@/lib/theme";

const synced = jest.fn();
jest.mock("@/app/(app)/plan/syncActions", () => ({
  syncPlan: (...a: unknown[]) => synced(...a),
}));

const empty: SyncPlan = {
  updates: [],
  additions: [],
  removals: [],
  unchanged: [],
};

const renderButton = (preview: SyncPlan) =>
  render(
    <ThemeProvider theme={theme}>
      <SyncButton preview={preview} onSynced={jest.fn()} />
    </ThemeProvider>,
  );

beforeEach(() => synced.mockClear());

describe("SyncButton", () => {
  test("reads Up to date and is disabled when there is nothing to do", () => {
    renderButton(empty);
    expect(screen.getByRole("button", { name: /up to date/i })).toBeDisabled();
  });

  test("counts every change, and breaks them down", () => {
    renderButton({
      updates: [
        {
          id: "p1",
          value: 1,
          label: "ISA",
          wrapper: null,
          flow: 0,
          terms: emptyRowTerms(),
        },
        {
          id: "p2",
          value: 2,
          label: "SIPP",
          wrapper: null,
          flow: 0,
          terms: emptyRowTerms(),
        },
      ],
      additions: [
        {
          linkId: "a3",
          kind: "ASSET",
          label: "Premium bonds",
          value: 5000,
          wrapper: null,
          flow: 0,
          defaults: {
            drawdownPriority: 0,
            incomeKind: null,
            expenseSection: null,
          },
          terms: emptyRowTerms(),
        },
      ],
      removals: [
        { id: "p4", label: "Old car", reason: "gone", dependsOn: null },
      ],
      unchanged: [],
    });
    expect(screen.getByRole("button", { name: /4 changes/i })).toBeEnabled();
    expect(screen.getByText(/2 updated/i)).toBeInTheDocument();
    expect(screen.getByText(/1 added/i)).toBeInTheDocument();
    expect(screen.getByText(/1 removed/i)).toBeInTheDocument();
  });

  // No confirmation when nothing is destroyed — a dialog on every press trains
  // people to click past it.
  test("syncs straight away when nothing would be removed", async () => {
    renderButton({
      updates: [
        {
          id: "p1",
          value: 42300,
          label: "ISA",
          wrapper: null,
          flow: 0,
          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /1 change/i }));
    });

    expect(synced).toHaveBeenCalled();
  });

  // The regression that would be invisible: a dialog rendered but hidden
  // still "works", it's just an extra click nobody would file a bug over.
  test("never renders the removal dialog when nothing would be removed", async () => {
    renderButton({
      updates: [
        {
          id: "p1",
          value: 42300,
          label: "ISA",
          wrapper: null,
          flow: 0,
          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /1 change/i }));
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  test("shows the removal dialog and withholds sync until confirmed", async () => {
    renderButton({
      updates: [],
      additions: [],
      removals: [
        {
          id: "p4",
          label: "Buy-to-let at 50",
          reason: "plan-only",
          dependsOn: null,
        },
      ],
      unchanged: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /1 change/i }));

    expect(
      screen.getByRole("alertdialog", { name: /remove 1 plan-only row/i }),
    ).toBeInTheDocument();
    expect(synced).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sync anyway/i }));
    });

    expect(synced).toHaveBeenCalled();
  });

  // A "gone" removal means the account was already archived or hard-deleted
  // through the balance sheet's own delete panel, which named counts and, for
  // a permanent delete, required typing DELETE. Asking again here is the
  // friction that teaches people to click past confirmations, so a bare
  // "gone" row does not gate. Plan-only and cascade rows do: neither has been
  // warned about anywhere else. See the next test for the cascade case.
  test("syncs straight away when the only removals are accounts already gone", async () => {
    renderButton({
      updates: [],
      additions: [],
      removals: [
        { id: "p4", label: "Old car", reason: "gone", dependsOn: null },
      ],
      unchanged: [],
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /1 change/i }));
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(synced).toHaveBeenCalled();
  });

  // The widened rule. A "gone" removal alone still syncs silently (above), but
  // one that takes a mortgage, a repayment or a property-sale scenario with it
  // destroys work nothing has warned about, so it must be named first.
  test("shows the confirmation when a gone removal drags something with it", () => {
    renderButton({
      updates: [],
      additions: [],
      removals: [
        { id: "a1", label: "The house", reason: "gone", dependsOn: null },
        {
          id: "l1",
          label: "Halifax mortgage",
          reason: "cascade",
          dependsOn: "a1",
        },
      ],
      unchanged: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /2 changes/i }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Halifax mortgage")).toBeInTheDocument();
    expect(synced).not.toHaveBeenCalled();
  });

  test("names only the plan-only rows when gone rows are also being removed", () => {
    renderButton({
      updates: [],
      additions: [],
      removals: [
        {
          id: "p1",
          label: "Buy-to-let at 50",
          reason: "plan-only",
          dependsOn: null,
        },
        { id: "p2", label: "Old car", reason: "gone", dependsOn: null },
        { id: "p3", label: "Dead ISA", reason: "gone", dependsOn: null },
      ],
      unchanged: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /3 changes/i }));

    const dialog = screen.getByRole("alertdialog", {
      name: /remove 1 plan-only row/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Buy-to-let at 50")).toBeInTheDocument();
    expect(screen.queryByText("Old car")).not.toBeInTheDocument();
    expect(screen.queryByText("Dead ISA")).not.toBeInTheDocument();
  });
});

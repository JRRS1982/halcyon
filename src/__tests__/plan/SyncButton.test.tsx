import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { SyncButton } from "@/app/(app)/plan/SyncButton";
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
        { id: "p1", value: 1, label: "ISA" },
        { id: "p2", value: 2, label: "SIPP" },
      ],
      additions: [
        { linkId: "a3", kind: "ASSET", label: "Premium bonds", value: 5000 },
      ],
      removals: [{ id: "p4", label: "Old car", reason: "gone" }],
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
      updates: [{ id: "p1", value: 42300, label: "ISA" }],
      additions: [],
      removals: [],
      unchanged: [],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /1 change/i }));
    });

    expect(synced).toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { DeleteAccountPanel } from "@/app/(app)/balance/DeleteAccountPanel";
import { theme } from "@/lib/theme";

const archive = jest.fn();
const deleteEverywhere = jest.fn();
jest.mock("@/app/(app)/balance/accountActions", () => ({
  archiveAccount: (...a: unknown[]) => archive(...a),
  deleteAccountEverywhere: (...a: unknown[]) => deleteEverywhere(...a),
}));

const counts = { months: 14, budgetRows: 6, linked: null };
const linkedCounts = {
  months: 14,
  budgetRows: 0,
  linked: { accountId: "m1", name: "Halifax mortgage", latestValue: 184200 },
};

const renderPanel = (
  props: Partial<Parameters<typeof DeleteAccountPanel>[0]> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <DeleteAccountPanel
        accountId="a1"
        name="Vanguard ISA"
        counts={counts}
        isProperty={false}
        year={2026}
        month={2}
        onClose={jest.fn()}
        onDone={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe("DeleteAccountPanel", () => {
  // A count is what stops the mistake; "are you sure?" is not.
  test("says how much history a full delete would remove", () => {
    renderPanel();
    expect(screen.getByText(/14 monthly values/i)).toBeInTheDocument();
    expect(screen.getByText(/6 budget/i)).toBeInTheDocument();
  });

  test("defaults to stop tracking", () => {
    renderPanel();
    expect(screen.getByRole("radio", { name: /stop tracking/i })).toBeChecked();
  });

  test("stop tracking archives without demanding confirmation text", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(archive).toHaveBeenCalledWith({
        accountId: "a1",
        alsoLinked: false,
        fromYear: 2026,
        fromMonth: 2,
      }),
    );
  });

  test("delete everywhere is blocked until DELETE is typed", () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole("radio", { name: /delete it everywhere/i }),
    );

    expect(screen.getByRole("button", { name: /^delete$/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
      target: { value: "DELETE" },
    });
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeEnabled();
  });

  // The checkbox used to be hidden here, because archiveAccount took a single
  // account id and could not keep the promise. It takes the partner now: a
  // mortgage on a property you have stopped tracking has nothing to sit
  // against, so archiving one offers to archive the other — pre-ticked for a
  // property, as deleting is.
  test("offers the partner in archive mode, the default, worded for archiving", () => {
    renderPanel({ name: "Home", counts: linkedCounts, isProperty: true });
    expect(screen.getByRole("radio", { name: /stop tracking/i })).toBeChecked();
    expect(
      screen.getByLabelText(/also stop tracking "halifax mortgage"/i),
    ).toBeChecked();
  });

  // Deleting a property: you rarely keep a debt secured on a house you no
  // longer hold, so the mortgage is pre-ticked.
  test("pre-ticks the partner when deleting a property", () => {
    renderPanel({ name: "Home", counts: linkedCounts, isProperty: true });
    fireEvent.click(
      screen.getByRole("radio", { name: /delete it everywhere/i }),
    );
    expect(
      screen.getByLabelText(/also delete "halifax mortgage"/i),
    ).toBeChecked();
  });

  // Deleting a mortgage: the commonest reason is that it is paid off, and you
  // still own the house.
  test("leaves the partner unticked when deleting a mortgage", () => {
    renderPanel({
      name: "Halifax mortgage",
      counts: {
        ...linkedCounts,
        linked: { accountId: "p1", name: "Home", latestValue: 420000 },
      },
      isProperty: false,
    });
    fireEvent.click(
      screen.getByRole("radio", { name: /delete it everywhere/i }),
    );
    expect(screen.getByLabelText(/also delete "home"/i)).not.toBeChecked();
  });

  test("passes the partner choice through", async () => {
    renderPanel({ name: "Home", counts: linkedCounts, isProperty: true });
    fireEvent.click(
      screen.getByRole("radio", { name: /delete it everywhere/i }),
    );
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(deleteEverywhere).toHaveBeenCalledWith({
        accountId: "a1",
        alsoLinked: true,
      }),
    );
  });
});

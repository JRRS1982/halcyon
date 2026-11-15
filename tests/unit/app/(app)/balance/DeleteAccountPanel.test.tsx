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

  // If this is wrong, a user reads "and the 0 budget transfers pointing at it".
  test("leaves out budget transfers when there are none", () => {
    renderPanel({ counts: { months: 1, budgetRows: 0, linked: null } });
    expect(
      screen.getByText("Removes 1 monthly value. This can’t be undone."),
    ).toBeInTheDocument();
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
        moveTransactionsTo: null,
      }),
    );
  });

  describe("an account that still has transactions", () => {
    const withLedger = {
      months: 3,
      budgetRows: 0,
      liveTransactions: 582,
      incomingTransfers: 2,
      linked: null,
    };
    const targets = [
      { id: "joint", name: "Joint Account" },
      { id: "savings", name: "Savings Account" },
    ];
    const deleteWithConfirm = () => {
      fireEvent.click(
        screen.getByRole("radio", { name: /delete it everywhere/i }),
      );
      fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
        target: { value: "DELETE" },
      });
    };

    // It used to say "Reassign or remove them first" and stop there.
    // No account is preselected: guessing would file 582 rows under
    // whichever account happens to sort first.
    test("offers to move them, and waits for an account to be chosen", () => {
      renderPanel({ counts: withLedger, moveTargets: targets });
      deleteWithConfirm();

      expect(
        screen.getByRole("radio", { name: /move them to another account/i }),
      ).toBeChecked();
      const picker = screen.getByRole("combobox", {
        name: /account to move them to/i,
      });
      expect(picker).toHaveValue("");
      const submit = screen.getByRole("button", {
        name: "Move 582 and delete",
      });
      expect(submit).toBeDisabled();

      fireEvent.change(picker, { target: { value: "joint" } });
      expect(submit).toBeEnabled();
    });

    test("moves them to the account chosen", async () => {
      renderPanel({ counts: withLedger, moveTargets: targets });
      deleteWithConfirm();
      fireEvent.change(
        screen.getByRole("combobox", { name: /account to move them to/i }),
        { target: { value: "savings" } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Move 582 and delete" }),
      );

      await waitFor(() =>
        expect(deleteEverywhere).toHaveBeenCalledWith({
          accountId: "a1",
          alsoLinked: false,
          moveTransactionsTo: "savings",
        }),
      );
    });

    test("deleting them says so on the button, and moves nothing", async () => {
      renderPanel({ counts: withLedger, moveTargets: targets });
      deleteWithConfirm();
      fireEvent.click(
        screen.getByRole("radio", { name: /delete them with the account/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Delete with 582 transactions" }),
      );

      await waitFor(() =>
        expect(deleteEverywhere).toHaveBeenCalledWith({
          accountId: "a1",
          alsoLinked: false,
          moveTransactionsTo: null,
        }),
      );
    });

    // If this is wrong, a user deletes Current Account and finds two
    // transfers on another account quietly changed with no word of warning.
    test("says what happens to other accounts' transfers that name it", () => {
      renderPanel({ counts: withLedger, moveTargets: targets });
      deleteWithConfirm();
      fireEvent.change(
        screen.getByRole("combobox", { name: /account to move them to/i }),
        { target: { value: "joint" } },
      );
      expect(
        screen.getByText(
          "2 transfers from other accounts will point to Joint Account instead.",
        ),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("radio", { name: /delete them with the account/i }),
      );
      expect(
        screen.getByText(
          "2 transfers from other accounts will no longer be marked as transfers.",
        ),
      ).toBeInTheDocument();
    });

    test("counts read with a thousands separator", () => {
      renderPanel({
        counts: { ...withLedger, liveTransactions: 1326 },
        moveTargets: targets,
      });
      deleteWithConfirm();
      expect(screen.getByText(/It has 1,326 transactions/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Move 1,326 and delete" }),
      ).toBeInTheDocument();
    });

    test("with nowhere to move them, only deleting is offered", () => {
      renderPanel({ counts: withLedger, moveTargets: [] });
      deleteWithConfirm();
      expect(
        screen.queryByRole("radio", { name: /move them/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete with 582 transactions" }),
      ).toBeEnabled();
    });

    // A partner leaving with it cannot also be where the rows go.
    test("never offers a partner that is being deleted too as the destination", () => {
      renderPanel({
        name: "Home",
        isProperty: true,
        counts: {
          ...withLedger,
          linked: {
            accountId: "m1",
            name: "Halifax mortgage",
            latestValue: 184200,
            liveTransactions: 10,
          },
        },
        moveTargets: [{ id: "m1", name: "Halifax mortgage" }, ...targets],
      });
      deleteWithConfirm();

      const options = Array.from(
        screen
          .getByRole("combobox", { name: /account to move them to/i })
          .querySelectorAll("option"),
      ).map((o) => o.textContent);
      expect(options).toEqual([
        "Choose an account…",
        "Joint Account",
        "Savings Account",
      ]);
      expect(
        screen.getByRole("button", { name: "Move 592 and delete" }),
      ).toBeInTheDocument();
    });
  });
});

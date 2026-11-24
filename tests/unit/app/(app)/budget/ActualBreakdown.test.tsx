import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { ActualBreakdown } from "@/app/(app)/budget/ActualBreakdown";
import type { ActualBreakdown as Breakdown } from "@/app/(app)/budget/actions";
import { formatAmount, formatSignedAmount } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

const getActualBreakdown = jest.fn();
jest.mock("@/app/(app)/budget/actions", () => ({
  getActualBreakdown: (...args: unknown[]) => getActualBreakdown(...args),
}));

const ITEM = "11111111-1111-1111-1111-111111111111";

const SAVINGS: Breakdown = {
  actual: 250,
  ledgerHref: "/transactions?counted=acct%3A2026-03",
  lines: [
    {
      id: "a",
      date: "2026-03-03T00:00:00.000Z",
      accountName: "Savings",
      description: "From Current",
      amount: 200,
      isPencilled: false,
      recordedOn: null,
    },
    {
      id: "b",
      date: "2026-03-24T00:00:00.000Z",
      accountName: "Monzo",
      description: "Pot to Savings",
      amount: 50,
      isPencilled: false,
      recordedOn: "Monzo",
    },
  ],
};

const GROCERIES: Breakdown = {
  actual: 102.95,
  ledgerHref: "/transactions?cat=c&from=2026-03-01&to=2026-03-31",
  lines: [
    {
      id: "a",
      date: "2026-03-02T00:00:00.000Z",
      accountName: "Current",
      description: "TESCO",
      amount: -64.2,
      isPencilled: false,
      recordedOn: null,
    },
    {
      id: "b",
      date: "2026-03-06T00:00:00.000Z",
      accountName: "Monzo",
      description: "SAINSBURYS",
      amount: -38.75,
      isPencilled: true,
      recordedOn: null,
    },
  ],
};

const rowMouseDown = jest.fn();

function renderFigure(
  props: Partial<Parameters<typeof ActualBreakdown>[0]> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      {/* Stands in for the sheet row, which selects itself on mousedown. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a test double for the row */}
      <div onMouseDown={rowMouseDown}>
        <ActualBreakdown
          itemId={ITEM}
          label="Groceries"
          context="Expenses · Variable"
          actual={102.95}
          budget={400}
          fmtAmount={(n) => formatAmount("GBP", n)}
          fmtSigned={(n) => formatSignedAmount("GBP", n)}
          {...props}
        />
      </div>
      <button type="button">Next cell</button>
      <p>Elsewhere on the page</p>
    </ThemeProvider>,
  );
}

const figure = () => screen.getByRole("button", { name: /Groceries Actual/ });

async function open() {
  await act(async () => {
    fireEvent.click(figure());
  });
  return screen.getByRole("dialog", { name: "Groceries transactions" });
}

beforeEach(() => {
  rowMouseDown.mockReset();
  getActualBreakdown.mockReset();
  getActualBreakdown.mockResolvedValue(GROCERIES);
});

describe("ActualBreakdown", () => {
  test("shows the figure, and fetches nothing until it is opened", () => {
    renderFigure();
    expect(figure()).toHaveTextContent(formatAmount("GBP", 102.95));
    expect(getActualBreakdown).not.toHaveBeenCalled();
  });

  test("lists the row's transactions, the pencilled one marked", async () => {
    renderFigure();
    const dialog = await open();

    expect(getActualBreakdown).toHaveBeenCalledWith({ itemId: ITEM });
    expect(dialog).toHaveTextContent("Expenses · Variable");
    expect(dialog).toHaveTextContent("2 transactions · 1 still in pencil");
    expect(screen.getByRole("row", { name: /SAINSBURYS/ })).toHaveTextContent(
      "pencil",
    );
    expect(screen.getByRole("row", { name: /TESCO/ })).not.toHaveTextContent(
      "pencil",
    );
    expect(screen.getByRole("row", { name: /TESCO/ })).toHaveTextContent(
      formatSignedAmount("GBP", -64.2),
    );
    expect(dialog).toHaveTextContent(
      `Actual ${formatAmount("GBP", 102.95)} of ${formatAmount("GBP", 400)} budgeted`,
    );
    expect(
      screen.getByRole("link", { name: /Open in ledger/ }),
    ).toHaveAttribute("href", GROCERIES.ledgerHref);
  });

  test("labels a transfer recorded on the other account's side", async () => {
    getActualBreakdown.mockResolvedValue(SAVINGS);
    renderFigure({ label: "Savings", context: "Transfers and saving" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Savings Actual/ }));
    });

    expect(
      screen.getByRole("row", { name: /Pot to Savings/ }),
    ).toHaveTextContent("Recorded on Monzo's side");
    expect(
      screen.getByRole("row", { name: /From Current/ }),
    ).not.toHaveTextContent("Recorded on");
  });

  test("says so when a row has no transactions", async () => {
    getActualBreakdown.mockResolvedValue({
      actual: 0,
      ledgerHref: "/transactions",
      lines: [],
    });
    renderFigure();
    expect(await open()).toHaveTextContent("No transactions");
  });

  test("Esc closes it and hands focus back to the figure", async () => {
    renderFigure();
    const dialog = await open();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(figure()).toHaveFocus();
  });

  test("a second click of the figure closes it", async () => {
    renderFigure();
    await open();
    fireEvent.mouseDown(figure());
    fireEvent.click(figure());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(figure()).toHaveAttribute("aria-expanded", "false");
  });

  test("a click outside closes it; a click inside does not", async () => {
    renderFigure();
    const dialog = await open();
    fireEvent.mouseDown(dialog);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.mouseDown(screen.getByText("Elsewhere on the page"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a click inside it leaves the row's selection alone", async () => {
    renderFigure();
    const dialog = await open();
    rowMouseDown.mockReset();
    fireEvent.mouseDown(dialog);
    expect(rowMouseDown).not.toHaveBeenCalled();
  });

  test("sits right after its figure, so Tab reaches it in reading order", async () => {
    renderFigure();
    const dialog = await open();
    expect(figure().nextElementSibling).toBe(dialog);
  });

  test("focus moving elsewhere on the page closes it", async () => {
    renderFigure();
    const dialog = await open();
    fireEvent.focusOut(dialog, {
      relatedTarget: screen.getByRole("button", { name: "Next cell" }),
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Shift+Tab back to the figure keeps it open", async () => {
    renderFigure();
    const dialog = await open();
    fireEvent.focusOut(dialog, { relatedTarget: figure() });
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  test("announces that it is loading", () => {
    getActualBreakdown.mockReturnValue(new Promise(() => {}));
    renderFigure();
    fireEvent.click(figure());
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  test("names its columns for a screen reader", async () => {
    renderFigure();
    await open();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["Date", "Account", "Description", "Amount"]);
  });

  test("says so when the transactions cannot be loaded", async () => {
    getActualBreakdown.mockRejectedValue(new Error("boom"));
    renderFigure();
    expect(await open()).toHaveTextContent("Couldn't load these transactions");
  });
});

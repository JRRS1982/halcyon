import { accountActual, netActual } from "@/lib/transactions/actual";
import { breakdownActual } from "@/lib/transactions/breakdown";
import {
  countedTransferLegs,
  netTransfersForAccounts,
} from "@/lib/transactions/transfers";

// If the popover's list and the sheet's Actual ever disagree, a user checking
// "what makes up this figure" is shown transactions that do not add up to it —
// the one thing the popover exists to rule out. Each case below computes the
// figure the way the budget page does and the way the popover does, and
// requires the two to match.

const leg = (
  id: string,
  accountId: string,
  counterpartyId: string,
  amount: number,
) => ({
  id,
  accountId,
  accountName: accountId,
  counterpartyId,
  counterpartyName: counterpartyId,
  amount,
});

type Kind = {
  type: "TRANSFER" | "REPAYMENT";
  direction: "INFLOW" | "OUTFLOW" | null;
};

// The sheet's figure for an account-keyed row, as page.tsx computes it.
const sheetFigure = (legs: ReturnType<typeof leg>[], id: string, kind: Kind) =>
  accountActual(
    netTransfersForAccounts(legs, legs).get(id) ?? 0,
    kind.type,
    kind.direction,
  );

// The popover's figure: the counted legs it lists, through breakdownActual.
const listedFigure = (legs: ReturnType<typeof leg>[], id: string, kind: Kind) =>
  breakdownActual(
    kind,
    (countedTransferLegs(legs, legs).get(id) ?? []).map((c) => c.amount),
  );

describe("breakdownActual agrees with the sheet", () => {
  test("an income row: receipts read positive, a clawback nets off", () => {
    const amounts = [3214.5, -14.5];
    expect(breakdownActual({ type: "INCOME", direction: null }, amounts)).toBe(
      netActual(amounts, "INCOME"),
    );
    expect(breakdownActual({ type: "INCOME", direction: null }, amounts)).toBe(
      3200,
    );
  });

  test("an expense row: spending reads positive, a refund nets off", () => {
    const amounts = [-64.2, -38.75, 10];
    expect(breakdownActual({ type: "EXPENSE", direction: null }, amounts)).toBe(
      netActual(amounts, "EXPENSE"),
    );
    expect(breakdownActual({ type: "EXPENSE", direction: null }, amounts)).toBe(
      92.95,
    );
  });

  test("a row with no transactions reads zero", () => {
    expect(breakdownActual({ type: "EXPENSE", direction: null }, [])).toBe(0);
    expect(breakdownActual({ type: "TRANSFER", direction: "INFLOW" }, [])).toBe(
      0,
    );
  });

  test("a transfer in, recorded on the account's own side", () => {
    const legs = [
      leg("a", "savings", "current", 200),
      leg("b", "current", "savings", -200),
    ];
    const kind: Kind = { type: "TRANSFER", direction: "INFLOW" };
    expect(listedFigure(legs, "savings", kind)).toBe(
      sheetFigure(legs, "savings", kind),
    );
    expect(listedFigure(legs, "savings", kind)).toBe(200);
  });

  test("a transfer in, recorded only on the other account's side", () => {
    const legs = [
      leg("a", "savings", "current", 200),
      leg("b", "monzo", "savings", -50),
    ];
    const kind: Kind = { type: "TRANSFER", direction: "INFLOW" };
    expect(listedFigure(legs, "savings", kind)).toBe(
      sheetFigure(legs, "savings", kind),
    );
    expect(listedFigure(legs, "savings", kind)).toBe(250);
  });

  test("a transfer out flips, other side included", () => {
    const legs = [
      leg("a", "isa", "current", -300),
      leg("b", "monzo", "isa", 20),
    ];
    const kind: Kind = { type: "TRANSFER", direction: "OUTFLOW" };
    expect(listedFigure(legs, "isa", kind)).toBe(
      sheetFigure(legs, "isa", kind),
    );
    expect(listedFigure(legs, "isa", kind)).toBe(320);
  });

  test("a debt payment recorded only from the current account", () => {
    const legs = [leg("a", "current", "mortgage", -1250)];
    const kind: Kind = { type: "REPAYMENT", direction: null };
    expect(listedFigure(legs, "mortgage", kind)).toBe(
      sheetFigure(legs, "mortgage", kind),
    );
    expect(listedFigure(legs, "mortgage", kind)).toBe(1250);
  });

  test("an account owning one pair still falls back on another", () => {
    // The pension pays a fee to the ISA (its own leg) and receives from the
    // current account (only current's leg records it).
    const legs = [
      leg("a", "pension", "isa", -100),
      leg("b", "current", "pension", -500),
      leg("c", "isa", "pension", 100),
    ];
    const kind: Kind = { type: "TRANSFER", direction: "INFLOW" };
    expect(listedFigure(legs, "pension", kind)).toBe(
      sheetFigure(legs, "pension", kind),
    );
    expect(listedFigure(legs, "pension", kind)).toBe(400);
  });
});

describe("countedTransferLegs", () => {
  test("never lists both sides of one pair", () => {
    const legs = [
      leg("own", "savings", "current", 200),
      leg("mirror", "current", "savings", -200),
    ];
    const counted = countedTransferLegs(legs, legs).get("savings") ?? [];
    expect(counted.map((c) => c.leg.id)).toEqual(["own"]);
    expect(counted[0]?.isOtherSide).toBe(false);
  });

  test("marks a leg recorded on the other account, signed from this one", () => {
    const legs = [leg("theirs", "monzo", "savings", -50)];
    const counted = countedTransferLegs(legs, legs).get("savings") ?? [];
    expect(counted).toEqual([{ leg: legs[0], amount: 50, isOtherSide: true }]);
  });
});

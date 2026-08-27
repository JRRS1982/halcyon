import {
  monthAccountKey,
  netTransfersByMonthAndAccount,
  netTransfersForAccounts,
} from "@/lib/transactions/transfers";

const leg = (accountId: string, counterpartyId: string, amount: number) => ({
  accountId,
  accountName: accountId,
  counterpartyId,
  counterpartyName: counterpartyId,
  amount,
});

describe("netTransfersForAccounts", () => {
  test("uses the account's own legs when it has any", () => {
    const own = [leg("pension", "current", 500)];
    const pointing = [leg("current", "pension", -500)];
    expect(netTransfersForAccounts(own, pointing).get("pension")).toBe(500);
  });

  test("falls back to legs pointing at it, sign-flipped", () => {
    const pointing = [leg("current", "pension", -500)];
    expect(netTransfersForAccounts([], pointing).get("pension")).toBe(500);
  });

  test("never sums both sources for one account", () => {
    const own = [leg("pension", "current", 500)];
    const pointing = [leg("current", "pension", -500)];
    // 500, not 1000: exactly one source is consulted.
    expect(netTransfersForAccounts(own, pointing).get("pension")).toBe(500);
  });

  test("the same leg set as both arguments still nets one movement once", () => {
    // How the server calls it: every leg is owned by its own account and
    // points at its counterparty, so one array is correctly both arguments.
    const legs = [
      leg("current", "pension", -500),
      leg("pension", "current", 500),
    ];
    const net = netTransfersForAccounts(legs, legs);
    expect(net.get("pension")).toBe(500);
    expect(net.get("current")).toBe(-500);
  });

  test("one-sided imports net the unseen account from the leg aimed at it", () => {
    const legs = [leg("current", "pension", -500)];
    const net = netTransfersForAccounts(legs, legs);
    expect(net.get("current")).toBe(-500);
    expect(net.get("pension")).toBe(500);
  });

  test("a pair the account does not own still falls back, alongside one it does", () => {
    // One month: the pension pays a 100 fee to an ISA (its own leg) and
    // receives 500 from the current account (only current's leg records it).
    // Owning the fee leg must not disable the fallback for the current-account
    // pair: 500 in, 100 out.
    const legs = [leg("pension", "isa", -100), leg("current", "pension", -500)];
    expect(netTransfersForAccounts(legs, legs).get("pension")).toBe(400);
  });

  test("an inbound owned leg flips to outbound for the counterparty", () => {
    // Pins the direction: a positive leg aimed at savings means money left
    // savings, so its fallback net is negative.
    const legs = [leg("current", "savings", 500)];
    expect(netTransfersForAccounts(legs, legs).get("savings")).toBe(-500);
  });

  test("nets several legs on one account", () => {
    const own = [
      leg("current", "pension", -500),
      leg("current", "isa", -200),
      leg("current", "savings", 50),
    ];
    expect(netTransfersForAccounts(own, own).get("current")).toBe(-650);
  });

  test("rounds to cents and normalises -0", () => {
    const own = [leg("current", "isa", -0.1), leg("current", "isa", -0.2)];
    expect(netTransfersForAccounts(own, own).get("current")).toBe(-0.3);
    const cancelling = [
      leg("current", "isa", -500),
      leg("current", "isa", 500),
    ];
    expect(
      Object.is(netTransfersForAccounts(cancelling, []).get("current"), 0),
    ).toBe(true);
  });

  test("no legs at all yields no entries", () => {
    expect(netTransfersForAccounts([], []).size).toBe(0);
  });
});

describe("netTransfersByMonthAndAccount", () => {
  const dated = (
    accountId: string,
    counterpartyId: string,
    amount: number,
    date: string,
  ) => ({ ...leg(accountId, counterpartyId, amount), date: new Date(date) });

  // The whole reason for bucketing: netting a twelve-month window in one go
  // gives a figure that is no month's flow.
  test("each month nets on its own", () => {
    const flow = netTransfersByMonthAndAccount([
      dated("current", "mortgage", -1250, "2026-03-10"),
      dated("current", "mortgage", -1250, "2026-04-10"),
    ]);

    expect(flow.get(monthAccountKey(new Date("2026-03-01"), "mortgage"))).toBe(
      1250,
    );
    expect(flow.get(monthAccountKey(new Date("2026-04-01"), "mortgage"))).toBe(
      1250,
    );
  });

  // The per-counterparty-pair source rule has to hold inside a bucket too, or
  // a month with both statements imported would count one movement twice.
  test("both legs of one movement in one month still count once", () => {
    const flow = netTransfersByMonthAndAccount([
      dated("current", "pension", -500, "2026-03-10"),
      dated("pension", "current", 500, "2026-03-10"),
    ]);

    expect(flow.get(monthAccountKey(new Date("2026-03-01"), "pension"))).toBe(
      500,
    );
  });

  test("a month with no legs has no entry", () => {
    const flow = netTransfersByMonthAndAccount([
      dated("current", "pension", -500, "2026-03-10"),
    ]);
    expect(
      flow.get(monthAccountKey(new Date("2026-04-01"), "pension")),
    ).toBeUndefined();
  });
});

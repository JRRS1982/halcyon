import { netTransfersForAccounts } from "@/lib/transactions/transfers";

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

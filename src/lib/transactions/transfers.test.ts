import { netTransfersByAccount, type TransferLeg } from "./transfers";

const leg = (
  accountId: string,
  accountName: string,
  counterpartyId: string,
  counterpartyName: string,
  amount: number,
): TransferLeg => ({
  accountId,
  accountName,
  counterpartyId,
  counterpartyName,
  amount,
});

describe("netTransfersByAccount", () => {
  it("nets signed amounts per owning account", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("cur", "Current", "sipp", "SIPP", -200),
      leg("isa", "ISA", "cur", "Current", 500),
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.accountId, r]));
    expect(byId.cur.net).toBe(-700);
    expect(byId.isa.net).toBe(500);
  });

  it("does NOT collapse the two legs of one transfer (different accounts)", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("isa", "ISA", "cur", "Current", 500),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.net).sort()).toEqual([-500, 500]);
  });

  it("breaks each account down by counterparty", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("cur", "Current", "isa", "ISA", -100),
      leg("cur", "Current", "sipp", "SIPP", -200),
    ]);
    const cur = rows.find((r) => r.accountId === "cur");
    expect(cur?.net).toBe(-800);
    expect(cur?.counterparties).toEqual([
      { accountId: "isa", accountName: "ISA", net: -600 },
      { accountId: "sipp", accountName: "SIPP", net: -200 },
    ]);
  });

  it("sorts accounts and counterparties by name and avoids -0", () => {
    const rows = netTransfersByAccount([
      leg("b", "Beta", "a", "Alpha", 100),
      leg("a", "Alpha", "b", "Beta", -100),
    ]);
    expect(rows.map((r) => r.accountName)).toEqual(["Alpha", "Beta"]);
    expect(Object.is(rows[0].net, -100)).toBe(true);
  });
});

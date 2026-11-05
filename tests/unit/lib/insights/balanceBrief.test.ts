import {
  accountChange,
  type BalanceBriefRow,
  balanceBrief,
} from "@/lib/insights/balanceBrief";

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const asset = (
  name: string,
  value: number | null,
  previous: number | null = null,
): BalanceBriefRow => ({
  name,
  kind: "ASSET",
  value,
  previous,
});
const debt = (
  name: string,
  value: number | null,
  previous: number | null = null,
): BalanceBriefRow => ({
  name,
  kind: "LIABILITY",
  value,
  previous,
});

const brief = (
  rows: BalanceBriefRow[],
  previousLabel: string | null = "September 2026",
) => balanceBrief({ rows, previousLabel, fmt });

// The balance page's headline. If it is wrong, a user is told their net worth
// rose when it fell, or a debt is counted as something they own.
describe("balanceBrief", () => {
  test("says how net worth moved since the previous month", () => {
    expect(
      brief([asset("ISA", 12000, 11000), debt("Mortgage", 150000, 150500)])
        .headline,
    ).toBe("Net worth rose £1,500 to −£138,000");
  });

  test("says when it fell", () => {
    expect(brief([asset("Current", 2000, 3000)]).headline).toBe(
      "Net worth fell £1,000 to £2,000",
    );
  });

  test("just states net worth when there is no earlier month", () => {
    expect(brief([asset("Current", 2000)], null).headline).toBe(
      "Net worth stands at £2,000",
    );
  });

  test("states what is owned and what is owed", () => {
    expect(
      brief([asset("ISA", 12000), debt("Mortgage", 150000)], null).standfirst,
    ).toBe("You own £12,000 and owe £150,000.");
  });

  test("names the account that gained most", () => {
    expect(
      brief([asset("ISA", 12000, 11000), asset("SIPP", 50000, 49800)]).notes,
    ).toContainEqual({
      lead: "Biggest gain.",
      body: "ISA rose £1,000 to £12,000 since September 2026.",
    });
  });

  // Paying a debt down is a gain for net worth, and should read as one.
  test("counts a debt paid down as progress", () => {
    expect(brief([debt("Mortgage", 149000, 150000)]).notes).toContainEqual({
      lead: "Debt paid down.",
      body: "You owe £1,000 less than in September 2026.",
    });
  });

  test("names the account that lost most", () => {
    expect(
      brief([asset("Current", 2000, 3500), asset("ISA", 12000, 11900)]).notes,
    ).toContainEqual({
      lead: "Biggest drop.",
      body: "Current fell £1,500 to £2,000 since September 2026.",
    });
  });

  test("lists the accounts still waiting for this month's value", () => {
    expect(
      brief([
        asset("ISA", null, 12000),
        asset("SIPP", null, 5000),
        asset("Current", 100),
      ]).notes,
    ).toContainEqual({
      lead: "Still to record.",
      body: "ISA and SIPP have no value for this month yet.",
    });
  });
});

// The balance sheet's Change column. If it is wrong, a growing debt is shown
// in green as if it were progress.
describe("accountChange", () => {
  test("an asset rising is favourable", () => {
    expect(accountChange("ASSET", 12000, 11000)).toEqual({
      amount: 1000,
      rose: true,
      favourable: true,
    });
  });

  test("a debt rising is not", () => {
    expect(accountChange("LIABILITY", 900, 800)).toEqual({
      amount: 100,
      rose: true,
      favourable: false,
    });
  });

  test("a debt falling is", () => {
    expect(accountChange("LIABILITY", 700, 800)?.favourable).toBe(true);
  });

  test("is nothing without both months' values", () => {
    expect(accountChange("ASSET", 100, null)).toBeNull();
    expect(accountChange("ASSET", null, 100)).toBeNull();
  });
});

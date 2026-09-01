import { kindOf } from "@/lib/accounts/accountDraft";
import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { seedStarterData } from "@/lib/settings/server";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

// The bug this restructure exists to kill: an account with no BalanceItem
// used to be invisible everywhere downstream, because nothing on the row
// itself said what kind of thing it was. Every creation path now writes a
// type up front, so the account exists as a typed thing from the moment
// it's created — independent of whether a balance sheet has ever observed
// it.
describe("every creation path produces a typed account", () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser();
  });

  it("seeded accounts carry the table's types", async () => {
    await prisma.$transaction((tx) => seedStarterData(tx, TEST_USER_ID));
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
      // Every seeded account shares sortOrder 0, so sortOrder alone leaves the
      // order unspecified — createdAt is what makes this list deterministic.
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { name: true, type: true, section: true },
    });
    expect(accounts.map((a) => a.type)).toEqual([
      "CURRENT_ACCOUNT",
      "CURRENT_ACCOUNT",
      "SAVINGS",
      "SAVINGS",
      "STOCKS_ISA",
      "SIPP",
    ]);
    // kind is computed from type, never stored.
    expect(new Set(accounts.map((a) => kindOf(a.type)))).toEqual(
      new Set(["ASSET"]),
    );
  });

  // Was EXPECTED RED until Task 7: reality.ts used to skip any account with
  // no BalanceItem, stranding a freshly-typed, never-observed account off
  // the plan. Task 7 fixed reality.ts to read every account in one indexed
  // pass, so this now passes — written ahead of that fix, on purpose, so it
  // proved the fix against a pre-existing test rather than one written
  // alongside it.
  it("reaches the plan even with no BalanceItem (stranded case)", async () => {
    await prisma.$transaction((tx) => seedStarterData(tx, TEST_USER_ID));
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    });

    const rows = await latestReality(TEST_USER_ID);
    for (const a of accounts) {
      expect(rows.map((r) => r.label)).toContain(a.name);
    }
  });
});

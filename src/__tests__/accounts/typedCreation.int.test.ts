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

  it("seeded accounts carry the table's types and mirrors", async () => {
    await prisma.$transaction((tx) => seedStarterData(tx, TEST_USER_ID));
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { sortOrder: "asc" },
      select: { name: true, type: true, section: true, kind: true },
    });
    expect(accounts.map((a) => a.type)).toEqual([
      "CURRENT_ACCOUNT",
      "CURRENT_ACCOUNT",
      "SAVINGS",
      "SAVINGS",
      "STOCKS_ISA",
      "SIPP",
    ]);
    // Mirrors written too — old deployed code reads kind during the window.
    expect(new Set(accounts.map((a) => a.kind))).toEqual(new Set(["ASSET"]));
  });

  // EXPECTED RED until Task 7: reality.ts still skips any account with no
  // BalanceItem, so a freshly-typed, never-observed account is still
  // stranded off the plan today. This is deliberately written now and left
  // failing so Task 7's fix is proven against a pre-existing test rather
  // than one written alongside it. See Task 3's report — excluded from this
  // task's gate for exactly that reason.
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

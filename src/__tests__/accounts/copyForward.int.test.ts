import {
  archiveAccount,
  createAccount,
} from "@/app/(app)/balance/accountActions";
import { copyBalancePeriodFrom } from "@/app/(app)/balance/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("balance copy-forward (integration)", () => {
  it("carries the account link into the next month", async () => {
    const { accountId, periodId } = await createAccount({
      year: 2026,
      month: 2,
      name: "Vanguard ISA",
      type: "STOCKS_ISA",
      section: "LONG_TERM",
      value: 42300,
      canImportTransactions: false,
      mortgage: null,
    });

    await copyBalancePeriodFrom({
      sourcePeriodId: periodId,
      targetYear: 2026,
      targetMonth: 3,
    });

    const april = await prisma.financialPeriod.findFirstOrThrow({
      where: { userId: TEST_USER_ID, startDate: new Date("2026-04-01") },
    });
    const copied = await prisma.balanceItem.findFirstOrThrow({
      where: { periodId: april.id },
    });

    expect(copied.accountId).toBe(accountId);
    // Still a number the user has not confirmed for April.
    expect(copied.carriedOver).toBe(true);
  });

  // The panel tells the user an archived account "leaves next month's
  // sheet" — copy-forward is the only thing that populates a new month, so
  // that promise is only true if it excludes the account's row.
  it("does not carry an archived account's row into the next month", async () => {
    const { accountId, periodId } = await createAccount({
      year: 2026,
      month: 2,
      name: "Premium bonds",
      type: "SAVINGS",
      section: "OTHER",
      value: 5000,
      canImportTransactions: false,
      mortgage: null,
    });

    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });
    await copyBalancePeriodFrom({
      sourcePeriodId: periodId,
      targetYear: 2026,
      targetMonth: 3,
    });

    const april = await prisma.financialPeriod.findFirstOrThrow({
      where: { userId: TEST_USER_ID, startDate: new Date("2026-04-01") },
    });
    const copiedRows = await prisma.balanceItem.findMany({
      where: { periodId: april.id, deletedAt: null },
    });

    expect(copiedRows.some((r) => r.accountId === accountId)).toBe(false);
  });
});

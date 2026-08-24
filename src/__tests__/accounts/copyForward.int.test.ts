import {
  archiveAccount,
  createAccountWithBalance,
} from "@/app/(app)/balance/accountActions";
import {
  copyBalancePeriodFrom,
  copyBalanceTemplateInto,
  saveBalanceTemplate,
} from "@/app/(app)/balance/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("balance copy-forward (integration)", () => {
  it("carries the account link into the next month", async () => {
    const { accountId, periodId } = await createAccountWithBalance({
      year: 2026,
      month: 2,
      name: "Vanguard ISA",
      type: "ASSET",
      category: "LONG_TERM",
      wrapper: "ISA",
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

  it("carries the account link through a saved template", async () => {
    const { accountId, periodId } = await createAccountWithBalance({
      year: 2026,
      month: 2,
      name: "Vanguard ISA",
      type: "ASSET",
      category: "LONG_TERM",
      wrapper: "ISA",
      value: 42300,
      canImportTransactions: false,
      mortgage: null,
    });

    await saveBalanceTemplate({ sourcePeriodId: periodId });
    await copyBalanceTemplateInto({ targetYear: 2026, targetMonth: 5 });

    const june = await prisma.financialPeriod.findFirstOrThrow({
      where: { userId: TEST_USER_ID, startDate: new Date("2026-06-01") },
    });
    const copied = await prisma.balanceItem.findFirstOrThrow({
      where: { periodId: june.id },
    });

    expect(copied.accountId).toBe(accountId);
  });

  // The panel tells the user an archived account "leaves next month's
  // sheet" — copy-forward is the only thing that populates a new month, so
  // that promise is only true if it excludes the account's row.
  it("does not carry an archived account's row into the next month", async () => {
    const { accountId, periodId } = await createAccountWithBalance({
      year: 2026,
      month: 2,
      name: "Premium bonds",
      type: "ASSET",
      category: "OTHER",
      wrapper: "CASH",
      value: 5000,
      canImportTransactions: false,
      mortgage: null,
    });

    await archiveAccount({ accountId });
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

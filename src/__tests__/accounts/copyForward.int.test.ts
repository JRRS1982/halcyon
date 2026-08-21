import { createAccountWithBalance } from "@/app/(app)/balance/accountActions";
import { copyBalancePeriodFrom } from "@/app/(app)/balance/actions";
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
});

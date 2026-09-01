import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// beforeEach in test/integration/setup.ts already resets the DB and seeds
// TEST_USER_ID; no local seedUser/seedPeriod helpers exist here (checked
// test/integration/helpers.ts), so periods are created directly, matching
// src/__tests__/accounts/schema.int.test.ts and budget/createItemForMonth.int.test.ts.

const createPeriod = () =>
  prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "March 2026",
    },
  });

describe("Budget transfer/repayment schema (integration)", () => {
  test("a TRANSFER row stores its account and direction", async () => {
    const period = await createPeriod();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });

    const row = await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        type: "TRANSFER",
        label: "ISA saving",
        budget: 250,
        accountId: account.id,
        direction: "INFLOW",
      },
    });

    expect(row.type).toBe("TRANSFER");
    expect(row.accountId).toBe(account.id);
    expect(row.direction).toBe("INFLOW");
  });

  test("a REPAYMENT row stores its account and no direction", async () => {
    const period = await createPeriod();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
      },
    });

    const row = await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        type: "REPAYMENT",
        label: "Mortgage",
        budget: 1250,
        accountId: account.id,
      },
    });

    expect(row.type).toBe("REPAYMENT");
    expect(row.direction).toBeNull();
  });
});

import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

describe("AccountTerms", () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser();
  });

  it("stores nine nullable parameters against one account", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Barclays mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
      },
    });

    await prisma.accountTerms.create({
      data: {
        accountId: account.id,
        interestPct: 4.29,
        interestOnly: false,
        revisionDate: new Date("2029-06-01"),
        revisionRate: 6.5,
        endDate: new Date("2049-06-01"),
      },
    });

    const terms = await prisma.accountTerms.findUnique({
      where: { accountId: account.id },
    });

    expect(terms).not.toBeNull();
    expect(Number(terms?.interestPct)).toBe(4.29);
    expect(Number(terms?.revisionRate)).toBe(6.5);
    expect(terms?.interestOnly).toBe(false);
    // Growth-side parameters are simply absent on a debt — not zero, not fenced.
    expect(terms?.expectedReturnPct).toBeNull();
    expect(terms?.feePct).toBeNull();
    expect(terms?.minAccessAge).toBeNull();
    expect(terms?.annualIncome).toBeNull();
  });

  it("is deleted with its account", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });
    await prisma.accountTerms.create({
      data: { accountId: account.id, expectedReturnPct: 5, feePct: 0.22 },
    });

    await prisma.account.delete({ where: { id: account.id } });

    expect(
      await prisma.accountTerms.findUnique({
        where: { accountId: account.id },
      }),
    ).toBeNull();
  });

  it("allows only one terms row per account", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "SIPP",
        ...buildAccountData({ type: "SIPP" }),
      },
    });
    await prisma.accountTerms.create({
      data: { accountId: account.id, minAccessAge: 57 },
    });

    await expect(
      prisma.accountTerms.create({
        data: { accountId: account.id, minAccessAge: 58 },
      }),
    ).rejects.toThrow();
  });
});

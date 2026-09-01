import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("Account registry columns (integration)", () => {
  it("defaults a new account to importable, with no link", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Barclays Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });

    expect(account.canImportTransactions).toBe(true);
    expect(account.linkedAccountId).toBeNull();
  });

  it("links a mortgage to its property, one to one", async () => {
    const property = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Home",
        ...buildAccountData({ type: "PROPERTY" }),
        canImportTransactions: false,
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
        canImportTransactions: false,
        linkedAccountId: property.id,
      },
    });

    expect(mortgage.linkedAccountId).toBe(property.id);

    // One to one: a second mortgage cannot claim the same property.
    await expect(
      prisma.account.create({
        data: {
          userId: TEST_USER_ID,
          name: "Second charge",
          ...buildAccountData({ type: "MORTGAGE" }),
          linkedAccountId: property.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("attaches a balance observation to an account", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    const item = await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 42300,
      },
    });

    expect(item.accountId).toBe(account.id);
  });
});

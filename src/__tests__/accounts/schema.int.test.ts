import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("Account registry columns (integration)", () => {
  it("defaults a new account to a plain importable transaction account", async () => {
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Barclays Current" },
    });

    expect(account.kind).toBe("NONE");
    expect(account.canImportTransactions).toBe(true);
    expect(account.category).toBeNull();
    expect(account.wrapper).toBeNull();
    expect(account.linkedAccountId).toBeNull();
  });

  it("links a mortgage to its property, one to one", async () => {
    const property = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Home",
        kind: "ASSET",
        category: "PROPERTY",
        wrapper: "PROPERTY",
        canImportTransactions: false,
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
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
          kind: "LIABILITY",
          linkedAccountId: property.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("attaches a balance observation to an account", async () => {
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
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

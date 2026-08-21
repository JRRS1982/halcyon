import { backfillAccountsForUser } from "@/lib/accounts/backfill";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function seedMonth(label: string, start: string, end: string) {
  return prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      startDate: new Date(start),
      endDate: new Date(end),
      label,
    },
  });
}

describe("backfillAccountsForUser (integration)", () => {
  it("collapses one label across months into a single account", async () => {
    const feb = await seedMonth("February 2026", "2026-02-01", "2026-02-28");
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");

    for (const [period, value] of [
      [feb, 41050],
      [mar, 42300],
    ] as const) {
      await prisma.balanceItem.create({
        data: {
          periodId: period.id,
          type: "ASSET",
          category: "LONG_TERM",
          label: "Vanguard ISA",
          value,
        },
      });
    }

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(1);
    expect(result.itemsLinked).toBe(2);

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    const isa = accounts.find((a) => a.name === "Vanguard ISA");
    expect(isa).toBeDefined();
    expect(isa?.kind).toBe("ASSET");
    expect(isa?.category).toBe("LONG_TERM");
    // inferWrapper reads "isa" out of the label.
    expect(isa?.wrapper).toBe("ISA");
    // A backfilled account has never had a statement imported to it.
    expect(isa?.canImportTransactions).toBe(false);

    const items = await prisma.balanceItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
    });
    expect(items.every((i) => i.accountId === isa?.id)).toBe(true);
  });

  it("is idempotent — a second run creates nothing and links nothing", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "CURRENT",
        label: "Cash",
        value: 500,
      },
    });

    const first = await backfillAccountsForUser(TEST_USER_ID);
    const second = await backfillAccountsForUser(TEST_USER_ID);

    expect(first.accountsCreated).toBe(1);
    expect(second).toEqual({ accountsCreated: 0, itemsLinked: 0 });
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  it("reuses an existing account with the same name rather than duplicating it", async () => {
    const existing = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Barclays Current" },
    });
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "CURRENT",
        label: "barclays current",
        value: 1200,
      },
    });

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(0);
    expect(result.itemsLinked).toBe(1);
    const item = await prisma.balanceItem.findFirst({
      where: { period: { userId: TEST_USER_ID } },
    });
    expect(item?.accountId).toBe(existing.id);
    // Reused, and promoted from a plain transaction account to an asset.
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(after.kind).toBe("ASSET");
  });

  it("keeps an asset and a liability of the same name apart", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.createMany({
      data: [
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Home",
          value: 420000,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Home",
          value: 184200,
        },
      ],
    });

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(2);
    const kinds = (
      await prisma.account.findMany({ where: { userId: TEST_USER_ID } })
    )
      .map((a) => a.kind)
      .sort();
    expect(kinds).toEqual(["ASSET", "LIABILITY"]);
  });

  it("leaves soft-deleted balance rows alone", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "OTHER",
        label: "Old thing",
        value: 10,
        deletedAt: new Date(),
      },
    });

    expect(await backfillAccountsForUser(TEST_USER_ID)).toEqual({
      accountsCreated: 0,
      itemsLinked: 0,
    });
  });

  it("leaves rows in a soft-deleted period alone", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.financialPeriod.update({
      where: { id: mar.id },
      data: { deletedAt: new Date() },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "OTHER",
        label: "Old thing",
        value: 10,
      },
    });

    expect(await backfillAccountsForUser(TEST_USER_ID)).toEqual({
      accountsCreated: 0,
      itemsLinked: 0,
    });
  });

  it("does not duplicate or re-link rows left over from a partially completed run", async () => {
    const feb = await seedMonth("February 2026", "2026-02-01", "2026-02-28");
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");

    // Simulates the state a real run fails into partway through: one month's
    // row already has its account and its link, the other month's row for
    // the same thing does not yet.
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        kind: "ASSET",
        category: "LONG_TERM",
        wrapper: "ISA",
        canImportTransactions: false,
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: feb.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 41050,
        accountId: account.id,
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 42300,
      },
    });

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result).toEqual({ accountsCreated: 0, itemsLinked: 1 });
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
    const items = await prisma.balanceItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
    });
    expect(items.every((i) => i.accountId === account.id)).toBe(true);
  });

  it("keeps an asset and a liability apart even when a NONE account of the same name already exists", async () => {
    const existing = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Home" },
    });
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.createMany({
      data: [
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Home",
          value: 420000,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Home",
          value: 184200,
        },
      ],
    });

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(1);
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(accounts).toHaveLength(2);
    const kinds = accounts.map((a) => a.kind).sort();
    expect(kinds).toEqual(["ASSET", "LIABILITY"]);

    const items = await prisma.balanceItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
    });
    const assetItem = items.find((i) => i.type === "ASSET");
    const liabilityItem = items.find((i) => i.type === "LIABILITY");
    expect(assetItem).toBeDefined();
    expect(liabilityItem).toBeDefined();
    expect(assetItem?.accountId).not.toBe(liabilityItem?.accountId);

    const promoted = accounts.find((a) => a.id === existing.id);
    expect(promoted).toBeDefined();
    expect(promoted?.kind).not.toBe("NONE");
    // The liability's own account should carry no plan-asset wrapper.
    const liabilityAccount = accounts.find(
      (a) => a.id === liabilityItem?.accountId,
    );
    expect(liabilityAccount?.wrapper).toBeNull();
  });

  async function seedHomeAndMortgageBalances() {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.createMany({
      data: [
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Home",
          value: 420000,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 184200,
        },
      ],
    });
  }

  async function seedMortgagePlan() {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
      },
    });
    const property = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 420000,
      },
    });
    const liability = await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Mortgage",
        openingBalance: 184200,
        linkedAssetId: property.id,
      },
    });
    return { plan, property, liability };
  }

  it("lifts a PlanLiability.linkedAssetId pairing onto Account.linkedAccountId", async () => {
    await seedHomeAndMortgageBalances();
    await seedMortgagePlan();

    await backfillAccountsForUser(TEST_USER_ID);

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    const home = accounts.find((a) => a.name === "Home");
    const mortgage = accounts.find((a) => a.name === "Mortgage");
    expect(home).toBeDefined();
    expect(mortgage).toBeDefined();
    expect(mortgage?.linkedAccountId).toBe(home?.id);
  });

  it("is idempotent for mortgage links — a second run neither duplicates nor re-links", async () => {
    await seedHomeAndMortgageBalances();
    await seedMortgagePlan();

    await backfillAccountsForUser(TEST_USER_ID);
    const afterFirst = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    const homeId = afterFirst.find((a) => a.name === "Home")?.id;

    const second = await backfillAccountsForUser(TEST_USER_ID);

    expect(second).toEqual({ accountsCreated: 0, itemsLinked: 0 });
    const afterSecond = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(afterSecond).toHaveLength(2);
    const mortgage = afterSecond.find((a) => a.name === "Mortgage");
    expect(mortgage?.linkedAccountId).toBe(homeId);
  });

  it("backfills cleanly with every linkedAccountId null when the user has no Plan", async () => {
    await seedHomeAndMortgageBalances();

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(2);
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(accounts.every((a) => a.linkedAccountId === null)).toBe(true);
  });

  it("leaves the mortgage unlinked when the linked PlanAsset has no matching account", async () => {
    // Only the mortgage has a balance row — "Home" was never entered on the
    // balance sheet, so no account exists for the property side of the pair.
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Mortgage",
        value: 184200,
      },
    });
    await seedMortgagePlan();

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result.accountsCreated).toBe(1);
    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(accounts).toHaveLength(1);
    const mortgage = accounts.find((a) => a.name === "Mortgage");
    expect(mortgage?.linkedAccountId).toBeNull();
  });
});

import { backfillAccountsForUser } from "@/lib/accounts/backfill";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

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

  it("skips a link that would violate the unique index because an archived mortgage already holds it", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    const home = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Home",
        kind: "ASSET",
        category: "PROPERTY",
      },
    });
    // An old mortgage, already linked to Home, then archived. Per
    // resolveLinkedPartnerId's own comment in accountActions.ts, an archived
    // partner is still linked — the unique index doesn't care that the row
    // is soft-deleted.
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Old Mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
        linkedAccountId: home.id,
        deletedAt: new Date(),
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "PROPERTY",
        label: "Home",
        value: 420000,
        accountId: home.id,
      },
    });
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

    // The new mortgage's own balance row still gets an account — only the
    // link to the already-claimed property is skipped, and the run commits.
    expect(result).toEqual({ accountsCreated: 1, itemsLinked: 1 });
    const mortgage = await prisma.account.findFirst({
      where: { userId: TEST_USER_ID, name: "Mortgage" },
    });
    expect(mortgage).toBeDefined();
    expect(mortgage?.linkedAccountId).toBeNull();
  });

  it("resolves the property side via PlanAsset.sourceBalanceItemId rather than a possibly-stale label", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    const flatItem = await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "PROPERTY",
        label: "Flat",
        value: 300000,
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "ASSET",
        category: "PROPERTY",
        label: "Home",
        value: 420000,
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: mar.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Mortgage",
        value: 184200,
      },
    });

    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
      },
    });
    // The plan asset's label says "Home" (edited independently after
    // seeding, or just mislabelled) but its sourceBalanceItemId is the
    // fact — it was actually seeded from the Flat balance row. The mortgage
    // must follow the fact, not the label.
    const property = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 300000,
        sourceBalanceItemId: flatItem.id,
      },
    });
    await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Mortgage",
        openingBalance: 184200,
        linkedAssetId: property.id,
      },
    });

    await backfillAccountsForUser(TEST_USER_ID);

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    const flat = accounts.find((a) => a.name === "Flat");
    const home = accounts.find((a) => a.name === "Home");
    const mortgage = accounts.find((a) => a.name === "Mortgage");
    expect(mortgage?.linkedAccountId).toBe(flat?.id);
    expect(mortgage?.linkedAccountId).not.toBe(home?.id);
  });

  it("lifts a mortgage link even when every balance row was already migrated by a prior run", async () => {
    // Simulates the real production scenario: an earlier run (before this
    // fix existed) already gave every balance row an accountId, so a
    // straightforward re-run finds nothing left in `items` — the mortgage
    // link must still be lifted from the Plan data alone.
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    const home = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Home",
        kind: "ASSET",
        category: "PROPERTY",
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
      },
    });
    await prisma.balanceItem.createMany({
      data: [
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Home",
          value: 420000,
          accountId: home.id,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 184200,
          accountId: mortgage.id,
        },
      ],
    });
    await seedMortgagePlan();

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result).toEqual({ accountsCreated: 0, itemsLinked: 0 });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    expect(after.linkedAccountId).toBe(home.id);
  });

  it("lets only the first of two mortgages claim a property shared by two plan rows", async () => {
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
          label: "Mortgage A",
          value: 100000,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage B",
          value: 50000,
        },
      ],
    });

    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
      },
    });
    // Two distinct PlanAsset rows sharing the label "Home" — PlanLiability's
    // own linkedAssetId is @unique, so two liabilities can't point at the
    // *same* PlanAsset row, but nothing stops two different PlanAsset rows
    // from sharing a label that resolves to one Account.
    const assetA = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 420000,
      },
    });
    const assetB = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 420000,
      },
    });
    await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Mortgage A",
        openingBalance: 100000,
        linkedAssetId: assetA.id,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Mortgage B",
        openingBalance: 50000,
        linkedAssetId: assetB.id,
        createdAt: new Date("2026-01-01T00:00:01.000Z"),
      },
    });

    await backfillAccountsForUser(TEST_USER_ID);

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    const home = accounts.find((a) => a.name === "Home");
    const mortgageA = accounts.find((a) => a.name === "Mortgage A");
    const mortgageB = accounts.find((a) => a.name === "Mortgage B");
    expect(mortgageA?.linkedAccountId).toBe(home?.id);
    expect(mortgageB?.linkedAccountId).toBeNull();
  });

  it("does not lift a mortgage link from another user's plan", async () => {
    await seedHomeAndMortgageBalances();

    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherPlan = await prisma.plan.create({
      data: {
        userId: OTHER_USER_ID,
        dateOfBirth: new Date("1980-01-01"),
        retirementAge: 65,
      },
    });
    const otherProperty = await prisma.planAsset.create({
      data: {
        planId: otherPlan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 100,
      },
    });
    await prisma.planLiability.create({
      data: {
        planId: otherPlan.id,
        label: "Mortgage",
        openingBalance: 100,
        linkedAssetId: otherProperty.id,
      },
    });

    await backfillAccountsForUser(TEST_USER_ID);

    const accounts = await prisma.account.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(accounts).toHaveLength(2);
    expect(accounts.every((a) => a.linkedAccountId === null)).toBe(true);
  });

  it("never overwrites an existing link, even when a different plan pairing is on the books", async () => {
    const mar = await seedMonth("March 2026", "2026-03-01", "2026-03-31");
    const home = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Home",
        kind: "ASSET",
        category: "PROPERTY",
      },
    });
    const oldHome = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Old Home",
        kind: "ASSET",
        category: "PROPERTY",
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
        // Already linked to a *different* property than the one the plan
        // below pairs it with.
        linkedAccountId: oldHome.id,
      },
    });
    await prisma.balanceItem.createMany({
      data: [
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Home",
          value: 420000,
          accountId: home.id,
        },
        {
          periodId: mar.id,
          type: "ASSET",
          category: "PROPERTY",
          label: "Old Home",
          value: 100000,
          accountId: oldHome.id,
        },
        {
          periodId: mar.id,
          type: "LIABILITY",
          category: "LONG_TERM",
          label: "Mortgage",
          value: 184200,
          accountId: mortgage.id,
        },
      ],
    });
    await seedMortgagePlan();

    const result = await backfillAccountsForUser(TEST_USER_ID);

    expect(result).toEqual({ accountsCreated: 0, itemsLinked: 0 });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    expect(after.linkedAccountId).toBe(oldHome.id);
  });
});

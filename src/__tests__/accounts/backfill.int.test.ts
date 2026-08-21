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
});

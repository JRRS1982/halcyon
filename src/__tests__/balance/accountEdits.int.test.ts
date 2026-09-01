import type { AccountType } from "@prisma/client";
import {
  renameAccount,
  setAccountType,
} from "@/app/(app)/balance/accountActions";
import {
  copyBalancePeriodFrom,
  upsertBalanceValue,
} from "@/app/(app)/balance/actions";
import { createItemForMonth } from "@/app/(app)/budget/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

// A typed account fixture — full data from buildAccountData, exactly the
// shape every real creation path writes (type/section/kind/wrapper).
function typedAccount(name: string, type: AccountType) {
  return prisma.account.create({
    data: { userId: TEST_USER_ID, name, ...buildAccountData({ type }) },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("setAccountType", () => {
  it("changes type within a kind and follows with the mirrors", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await setAccountType({ accountId: a.id, type: "STOCKS_ISA" });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(after.type).toBe("STOCKS_ISA");
    expect(after.wrapper).toBe("ISA"); // mirror
    expect(after.section).toBe("MEDIUM_TERM"); // untouched — user's section stays
  });

  it("refuses a cross-kind change", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await expect(
      setAccountType({ accountId: a.id, type: "LOAN" }),
    ).rejects.toThrow(/asset and liability/);
  });

  it("refuses while linked, naming the link", async () => {
    const property = await typedAccount("Home", "PROPERTY");
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
        linkedAccountId: property.id,
      },
    });

    await expect(
      setAccountType({ accountId: property.id, type: "OTHER_ASSET" }),
    ).rejects.toThrow(/linked/);
    await expect(
      setAccountType({ accountId: mortgage.id, type: "LOAN" }),
    ).rejects.toThrow(/linked/);
  });

  it("refuses leaving PROPERTY with a sale event, naming it", async () => {
    const property = await typedAccount("Home", "PROPERTY");
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        isPrimary: true,
      },
    });
    const planAsset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 300000,
        accountId: property.id,
      },
    });
    await prisma.planEvent.create({
      data: {
        planId: plan.id,
        label: "Downsize",
        age: 70,
        direction: "INFLOW",
        kind: "PROPERTY_SALE",
        assetId: planAsset.id,
      },
    });

    await expect(
      setAccountType({ accountId: property.id, type: "OTHER_ASSET" }),
    ).rejects.toThrow(/sale event/);
  });

  it("allows moving TO property with no blocker, leaving section alone", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await setAccountType({ accountId: a.id, type: "PROPERTY" });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(after.type).toBe("PROPERTY");
    expect(after.wrapper).toBe("PROPERTY");
    expect(after.section).toBe("MEDIUM_TERM");
  });
});

describe("upsertBalanceValue", () => {
  it("creates then updates — never duplicates", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 100,
    });
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 250,
    });
    const rows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, deletedAt: null },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.value)).toBe(250);
    expect(rows[0]?.carriedOver).toBe(false);
  });
});

describe("copyBalancePeriodFrom", () => {
  it("copying into a month that already has a value replaces it and marks carriedOver", async () => {
    const a = await typedAccount("Pot", "SAVINGS");

    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 0,
      value: 100,
    });
    const source = await prisma.financialPeriod.findFirstOrThrow({
      where: {
        userId: TEST_USER_ID,
        startDate: monthRangeFor(2026, 0).startDate,
      },
    });

    // The target month already has a live, user-confirmed value — copying
    // must replace it, not sit alongside it.
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 1,
      value: 999,
    });

    const result = await copyBalancePeriodFrom({
      sourcePeriodId: source.id,
      targetYear: 2026,
      targetMonth: 1,
    });

    const liveRows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, periodId: result.periodId, deletedAt: null },
    });
    expect(liveRows).toHaveLength(1);
    expect(Number(liveRows[0]?.value)).toBe(100);
    expect(liveRows[0]?.carriedOver).toBe(true);

    // The old value is soft-deleted, not left live alongside the new one —
    // the partial unique index on live (periodId, accountId) rows would
    // reject two live rows for the same account+month.
    const allTargetRows = await prisma.balanceItem.findMany({
      where: { accountId: a.id, periodId: result.periodId },
    });
    expect(allTargetRows).toHaveLength(2);
    expect(allTargetRows.filter((r) => r.deletedAt !== null)).toHaveLength(1);
  });
});

describe("renameAccount", () => {
  it("renames the account and every live budget row anchored to it", async () => {
    const a = await typedAccount("Old ISA", "STOCKS_ISA");
    await createItemForMonth({
      year: 2026,
      month: 2,
      type: "TRANSFER",
      label: "Old ISA",
      accountId: a.id,
      direction: "INFLOW",
    });
    await renameAccount({ accountId: a.id, name: "New ISA" });
    const row = await prisma.budgetItem.findFirstOrThrow({
      where: { accountId: a.id },
    });
    expect(row.label).toBe("New ISA");
  });

  it("also renames the account's live balance row mirror", async () => {
    const a = await typedAccount("Old ISA", "STOCKS_ISA");
    await upsertBalanceValue({
      accountId: a.id,
      year: 2026,
      month: 2,
      value: 100,
    });
    await renameAccount({ accountId: a.id, name: "New ISA" });
    const row = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId: a.id },
    });
    expect(row.label).toBe("New ISA");
  });
});

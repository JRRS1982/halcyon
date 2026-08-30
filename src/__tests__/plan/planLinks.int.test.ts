import { deletePlanAsset } from "@/app/(app)/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function seedPlan() {
  return prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1985-01-01"),
      retirementAge: 60,
    },
  });
}

describe("plan row links (integration)", () => {
  it("links an asset to an account and a nulls it when the account goes", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    const asset = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
    });

    expect(asset.accountId).toBe(account.id);

    // SetNull, not Cascade: the row must survive so Sync can remove it
    // explicitly rather than it vanishing mid-projection.
    await prisma.account.delete({ where: { id: account.id } });
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(after.accountId).toBeNull();
  });

  it("links a liability to an account", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
      },
    });
    const liability = await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Halifax mortgage",
        accountId: account.id,
      },
    });
    expect(liability.accountId).toBe(account.id);
  });

  it("links incomes and expenses to a category", async () => {
    const plan = await seedPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
      },
    });
    const income = await prisma.planIncome.create({
      data: {
        planId: plan.id,
        label: "Salary",
        kind: "SALARY",
        categoryId: category.id,
      },
    });
    const expense = await prisma.planExpense.create({
      data: { planId: plan.id, label: "Food", categoryId: category.id },
    });

    expect(income.categoryId).toBe(category.id);
    expect(expense.categoryId).toBe(category.id);
  });

  it("allows a plan-only row with no link", async () => {
    const plan = await seedPlan();
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Buy-to-let at 50",
        openingValue: 250000,
      },
    });
    expect(asset.accountId).toBeNull();
  });

  // Two concurrent Syncs resolve the same "add this account" against the same
  // plan and both reach the create — resolvePlanSync runs outside the
  // transaction, so nothing in code can stop it. The database can.
  it("rejects a second row linking the same plan to the same account", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    await prisma.planAsset.create({
      data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
    });

    await expect(
      prisma.planAsset.create({
        data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("rejects a second liability linking the same plan to the same account", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
      },
    });
    await prisma.planLiability.create({
      data: { planId: plan.id, label: "Halifax", accountId: account.id },
    });

    await expect(
      prisma.planLiability.create({
        data: { planId: plan.id, label: "Halifax", accountId: account.id },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("rejects a second income or expense linking the same plan to the same category", async () => {
    const plan = await seedPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
      },
    });
    await prisma.planIncome.create({
      data: {
        planId: plan.id,
        label: "Salary",
        kind: "SALARY",
        categoryId: category.id,
      },
    });
    await prisma.planExpense.create({
      data: { planId: plan.id, label: "Food", categoryId: category.id },
    });

    await expect(
      prisma.planIncome.create({
        data: {
          planId: plan.id,
          label: "Salary",
          kind: "SALARY",
          categoryId: category.id,
        },
      }),
    ).rejects.toThrow(/Unique constraint/);
    await expect(
      prisma.planExpense.create({
        data: { planId: plan.id, label: "Food", categoryId: category.id },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });

  // Postgres treats NULLs as distinct in a unique index (NULLS DISTINCT is the
  // default), so the constraint above leaves plan-only rows alone. If it did
  // not, the plan's own Add buttons would fail on the second press.
  it("allows a plan a second, third and fourth plan-only row", async () => {
    const plan = await seedPlan();
    for (const label of ["Buy-to-let at 50", "Boat", "Vintage car"]) {
      await prisma.planAsset.create({ data: { planId: plan.id, label } });
    }
    for (const label of ["Sabbatical", "School fees"]) {
      await prisma.planExpense.create({ data: { planId: plan.id, label } });
    }

    expect(await prisma.planAsset.count({ where: { planId: plan.id } })).toBe(
      3,
    );
    expect(await prisma.planExpense.count({ where: { planId: plan.id } })).toBe(
      2,
    );
  });

  // Deleting a plan row is a soft delete. Its link is cleared at the same
  // moment, so the tombstone cannot collide with the row the next Sync adds
  // for the same account — see deletePlanAsset in plan/actions.ts.
  it("clears the link when a row is soft-deleted, leaving the account free", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    const first = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
    });
    await deletePlanAsset({ id: first.id });

    const tombstone = await prisma.planAsset.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(tombstone.deletedAt).not.toBeNull();
    expect(tombstone.accountId).toBeNull();

    const second = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
    });
    expect(second.accountId).toBe(account.id);
  });
});

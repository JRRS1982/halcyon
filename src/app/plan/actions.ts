"use server";

import {
  type UpdatePlanAssetInput,
  type UpdatePlanAssumptionsInput,
  type UpdatePlanEventInput,
  type UpdatePlanExpenseInput,
  type UpdatePlanIncomeInput,
  type UpdatePlanLiabilityInput,
  deleteRowSchema,
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanEventSchema,
  updatePlanExpenseSchema,
  updatePlanIncomeSchema,
  updatePlanLiabilitySchema,
} from "@/lib/plan/schemas";
import {
  type SeedBalanceItem,
  type SeedFinancialItem,
  seedPlanChildren,
} from "@/lib/plan/seed";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/plan");
  return user.id;
}

export async function getPrimaryPlan(userId: string) {
  return prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    include: {
      assets: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      liabilities: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      incomes: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      expenses: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      events: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
}

const createPlanSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(90),
});

const linkRepaymentSchema = z.object({ liabilityId: z.string().uuid() });

export async function createPlan(input: {
  dateOfBirth: string;
  retirementAge: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { dateOfBirth, retirementAge } = createPlanSchema.parse(input);

  // One primary plan per user (v1). Guard + create are atomic to prevent double-create races.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.plan.findFirst({
      where: { userId, isPrimary: true, deletedAt: null },
      select: { id: true },
    });
    if (existing) return;

    // Seed from the most recent non-deleted month period (balance + budget share it).
    const period = await tx.financialPeriod.findFirst({
      where: { userId, granularity: "MONTH", deletedAt: null },
      orderBy: { startDate: "desc" },
      include: {
        balanceItems: { where: { deletedAt: null } },
        items: { where: { deletedAt: null } },
      },
    });

    const balanceItems: SeedBalanceItem[] = (period?.balanceItems ?? []).map(
      (b) => ({
        id: b.id,
        type: b.type,
        category: b.category,
        label: b.label,
        value: Number(b.value),
      }),
    );
    const financialItems: SeedFinancialItem[] = (period?.items ?? []).map(
      (f) => ({
        type: f.type,
        incomeCategory: f.incomeCategory,
        category: f.category,
        label: f.label,
        budget: Number(f.budget),
        sourceCategoryId: f.categoryId,
      }),
    );

    const seeded = seedPlanChildren(
      balanceItems,
      financialItems,
      retirementAge,
    );

    const currentAge =
      new Date().getUTCFullYear() - new Date(dateOfBirth).getUTCFullYear();
    const carAge = Math.min(currentAge + 5, 94); // planToAge default 95 − 1

    await tx.plan.create({
      data: {
        userId,
        dateOfBirth: new Date(dateOfBirth),
        retirementAge,
        returnSpreadPct: 2,
        statePensionAge: 67,
        // UK full new State Pension (approx 2024/25); user edits this in Phase 1b.
        statePensionAnnual: 11500,
        assets: { create: seeded.assets },
        liabilities: { create: seeded.liabilities },
        incomes: { create: seeded.incomes },
        expenses: { create: seeded.expenses },
        events: {
          create: [
            {
              label: "New car",
              age: carAge,
              direction: "OUTFLOW",
              amount: 15000,
            },
          ],
        },
      },
    });
  });

  revalidatePath("/plan");
}

export async function updatePlanAssumptions(
  input: UpdatePlanAssumptionsInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanAssumptionsSchema.parse(input);
  const res = await prisma.plan.updateMany({
    where: { id: p.planId, userId, deletedAt: null },
    data: {
      dateOfBirth: new Date(p.dateOfBirth),
      retirementAge: p.retirementAge,
      planToAge: p.planToAge,
      inflationPct: p.inflationPct,
      defaultReturnPct: p.defaultReturnPct,
      returnSpreadPct: p.returnSpreadPct,
      blendedTaxRatePct: p.blendedTaxRatePct,
      statePensionAge: p.statePensionAge,
      statePensionAnnual: p.statePensionAnnual,
    },
  });
  if (res.count === 0) throw new Error("Plan not found");
  revalidatePath("/plan");
}

export async function updatePlanAsset(
  input: UpdatePlanAssetInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanAssetSchema.parse(input);
  const res = await prisma.planAsset.updateMany({
    where: {
      id: p.assetId,
      deletedAt: null,
      plan: { userId, deletedAt: null },
    },
    data: {
      label: p.label,
      wrapper: p.wrapper,
      openingValue: p.openingValue,
      expectedReturnPct: p.expectedReturnPct,
      feePct: p.feePct,
      annualContribution: p.annualContribution,
      contributionEndAge: p.contributionEndAge,
      minAccessAge: p.minAccessAge,
      drawdownPriority: p.drawdownPriority,
    },
  });
  if (res.count === 0) throw new Error("Asset not found");
  revalidatePath("/plan");
}

export async function updatePlanLiability(
  input: UpdatePlanLiabilityInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanLiabilitySchema.parse(input);
  const res = await prisma.planLiability.updateMany({
    where: {
      id: p.liabilityId,
      deletedAt: null,
      plan: { userId, deletedAt: null },
    },
    data: {
      label: p.label,
      openingBalance: p.openingBalance,
      interestPct: p.interestPct,
      monthlyRepayment: p.monthlyRepayment,
      startAge: p.startAge,
      endAge: p.endAge,
    },
  });
  if (res.count === 0) throw new Error("Liability not found");
  revalidatePath("/plan");
}

async function requirePrimaryPlan(userId: string) {
  const plan = await prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    select: { id: true, retirementAge: true },
  });
  if (!plan) throw new Error("Plan not found");
  return plan;
}

export async function createPlanAsset(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planAsset.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "New asset",
      wrapper: "OTHER",
      openingValue: 0,
      annualContribution: 0,
      drawdownPriority: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

export async function createPlanLiability(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planLiability.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planLiability.create({
    data: {
      planId: plan.id,
      label: "New liability",
      openingBalance: 0,
      interestPct: 0,
      monthlyRepayment: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

export async function createPlanIncome(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planIncome.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planIncome.create({
    data: {
      planId: plan.id,
      label: "New income",
      kind: "OTHER",
      annualAmount: 0,
      growthKind: "INFLATION",
      taxable: true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

export async function createPlanExpense(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planExpense.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planExpense.create({
    data: {
      planId: plan.id,
      label: "New expense",
      category: "FIXED",
      annualAmount: 0,
      inflationLinked: true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

export async function createPlanEvent(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planEvent.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planEvent.create({
    data: {
      planId: plan.id,
      label: "New event",
      age: plan.retirementAge,
      direction: "OUTFLOW",
      amount: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

export async function deletePlanAsset(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planAsset.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Asset not found");
  revalidatePath("/plan");
}

export async function deletePlanLiability(input: {
  id: string;
}): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const res = await tx.planLiability.updateMany({
      where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new Error("Liability not found");
    // The repayment can't outlive the debt: cascade the soft delete.
    await tx.planExpense.updateMany({
      where: { liabilityId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  });
  revalidatePath("/plan");
}

export async function deletePlanIncome(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planIncome.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Income not found");
  revalidatePath("/plan");
}

export async function deletePlanExpense(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const expense = await tx.planExpense.findFirst({
      where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
      select: { liabilityId: true },
    });
    if (!expense) throw new Error("Expense not found");
    if (expense.liabilityId !== null)
      throw new Error(
        "This repayment is managed by a liability — delete the liability, or unlink it first",
      );
    await tx.planExpense.updateMany({
      where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
      data: { deletedAt: new Date() },
    });
  });
  revalidatePath("/plan");
}

// Creates the liability's linked repayment expense (idempotent). The expense
// owns the payment amount from here on; timing stays on the liability.
export async function linkRepaymentExpense(input: {
  liabilityId: string;
}): Promise<string> {
  const userId = await requireUserId();
  const { liabilityId } = linkRepaymentSchema.parse(input);
  const id = await prisma.$transaction(async (tx) => {
    const liability = await tx.planLiability.findFirst({
      where: {
        id: liabilityId,
        deletedAt: null,
        plan: { userId, deletedAt: null },
      },
    });
    if (!liability) throw new Error("Liability not found");
    const existing = await tx.planExpense.findFirst({
      where: { liabilityId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const max = await tx.planExpense.aggregate({
      where: { planId: liability.planId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const row = await tx.planExpense.create({
      data: {
        planId: liability.planId,
        label: `${liability.label} repayment`,
        category: null,
        annualAmount: Number(liability.monthlyRepayment) * 12,
        inflationLinked: false,
        liabilityId,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return row.id;
  });
  revalidatePath("/plan");
  return id;
}

// Detaches a linked repayment expense; the liability falls back to
// monthlyRepayment at the expense's current amount so projections don't jump.
export async function unlinkRepaymentExpense(input: {
  id: string;
}): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const expense = await tx.planExpense.findFirst({
      where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    });
    if (!expense?.liabilityId) throw new Error("Linked expense not found");
    await tx.planLiability.update({
      where: { id: expense.liabilityId },
      data: { monthlyRepayment: Number(expense.annualAmount) / 12 },
    });
    await tx.planExpense.update({
      where: { id },
      data: { liabilityId: null },
    });
  });
  revalidatePath("/plan");
}

export async function deletePlanEvent(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planEvent.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Event not found");
  revalidatePath("/plan");
}

export async function updatePlanIncome(
  input: UpdatePlanIncomeInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanIncomeSchema.parse(input);
  const res = await prisma.planIncome.updateMany({
    where: {
      id: p.incomeId,
      deletedAt: null,
      plan: { userId, deletedAt: null },
    },
    data: {
      label: p.label,
      kind: p.kind,
      annualAmount: p.annualAmount,
      startAge: p.startAge,
      endAge: p.endAge,
      growthKind: p.growthKind,
      growthPct: p.growthPct,
      taxable: p.taxable,
    },
  });
  if (res.count === 0) throw new Error("Income not found");
  revalidatePath("/plan");
}

export async function updatePlanExpense(
  input: UpdatePlanExpenseInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanExpenseSchema.parse(input);
  const res = await prisma.planExpense.updateMany({
    where: {
      id: p.expenseId,
      deletedAt: null,
      plan: { userId, deletedAt: null },
    },
    data: {
      label: p.label,
      category: p.category,
      annualAmount: p.annualAmount,
      startAge: p.startAge,
      endAge: p.endAge,
      inflationLinked: p.inflationLinked,
    },
  });
  if (res.count === 0) throw new Error("Expense not found");
  revalidatePath("/plan");
}

export async function updatePlanEvent(
  input: UpdatePlanEventInput,
): Promise<void> {
  const userId = await requireUserId();
  const p = updatePlanEventSchema.parse(input);
  const res = await prisma.planEvent.updateMany({
    where: {
      id: p.eventId,
      deletedAt: null,
      plan: { userId, deletedAt: null },
    },
    data: {
      label: p.label,
      age: p.age,
      direction: p.direction,
      amount: p.amount,
    },
  });
  if (res.count === 0) throw new Error("Event not found");
  revalidatePath("/plan");
}

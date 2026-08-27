"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applySyncPlan } from "@/lib/plan/applySyncPlan";
import { latestReality } from "@/lib/plan/reality";
import {
  deleteRowSchema,
  type UpdatePlanAssetInput,
  type UpdatePlanAssumptionsInput,
  type UpdatePlanEventInput,
  type UpdatePlanExpenseInput,
  type UpdatePlanIncomeInput,
  type UpdatePlanLiabilityInput,
  updatePlanAssetSchema,
  updatePlanAssumptionsSchema,
  updatePlanEventSchema,
  updatePlanExpenseSchema,
  updatePlanIncomeSchema,
  updatePlanLiabilitySchema,
} from "@/lib/plan/schemas";
import { resolvePlanSync } from "@/lib/plan/sync";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadPlanRecordForRender } from "./planRecord";

// Same contract as before — the signed-in user's id, or a redirect to sign-in
// with /plan as the return path. The difference is the call underneath:
// getCurrentUser is memoised with React's cache(), so a render that touches
// several of these actions authenticates once instead of once per action.
//
// Per-request memoisation, not a cache across requests: a signed-out visitor
// never inherits a previous request's session. getCurrentUser's own doc
// comment describes this being done for the layout and settings paths; the
// plan actions simply never adopted it.
async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/plan");
  return user.id;
}

export async function getPrimaryPlan() {
  const userId = await requireUserId();
  return loadPlanRecordForRender(userId);
}

// Retirement age is not asked for at create time — it is seeded with the same
// default the Assumptions panel then edits (which is what drives the charts).
const createPlanSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(90).default(67),
});

const linkRepaymentSchema = z.object({ liabilityId: z.string().uuid() });

export async function createPlan(input: {
  dateOfBirth: string;
  retirementAge?: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { dateOfBirth, retirementAge } = createPlanSchema.parse(input);

  // Read reality before opening the transaction, not inside it: latestReality
  // uses the module-level client, so a call from inside would hold one pooled
  // connection while asking for another, and its ~1 + accounts + 1 + categories
  // round trips would run against the 5s interactive-transaction timeout.
  // Nothing below depends on the read being inside — createPlan only adds rows
  // to a plan it has just created.
  const reality = await latestReality(userId);

  // One primary plan per user (v1). Guard + create are atomic to prevent double-create races.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.plan.findFirst({
      where: { userId, isPrimary: true, deletedAt: null },
      select: { id: true },
    });
    if (existing) return;

    const currentAge =
      new Date().getUTCFullYear() - new Date(dateOfBirth).getUTCFullYear();
    const carAge = Math.min(currentAge + 5, 94); // planToAge default 95 − 1

    const plan = await tx.plan.create({
      data: {
        userId,
        dateOfBirth: new Date(dateOfBirth),
        retirementAge,
        returnSpreadPct: 2,
        statePensionAge: 67,
        // UK full new State Pension (approx 2024/25); user edits this in Phase 1b.
        statePensionAnnual: 11500,
        // ONS-ish default life expectancy; user edits in the Assumptions panel.
        expectedDeathAge: 90,
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

    // A fresh plan has no rows of its own, so syncing it against reality is
    // exactly seeding: every live account and budget category becomes a row,
    // carrying the wrapper/value the user actually recorded rather than a
    // guess (see docs/superpowers/specs/2026-08-25-plan-sync-design.md).
    await applySyncPlan(
      tx,
      plan.id,
      userId,
      resolvePlanSync([], reality, []),
      new Map(),
    );
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
      expectedDeathAge: p.expectedDeathAge,
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

  if (p.linkedAssetId !== null) {
    const asset = await prisma.planAsset.findFirst({
      where: {
        id: p.linkedAssetId,
        deletedAt: null,
        plan: { userId, deletedAt: null },
      },
      select: { wrapper: true },
    });
    if (asset?.wrapper !== "PROPERTY")
      throw new Error("Linked asset must be a property");
  }

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
      linkedAssetId: p.linkedAssetId,
      interestOnly: p.interestOnly,
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

export async function createPlanProperty(): Promise<string> {
  const userId = await requireUserId();
  const plan = await requirePrimaryPlan(userId);
  const max = await prisma.planAsset.aggregate({
    where: { planId: plan.id, deletedAt: null },
    _max: { sortOrder: true },
  });
  const row = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "New property",
      wrapper: "PROPERTY",
      openingValue: 0,
      annualContribution: 0,
      drawdownPriority: 0,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/plan");
  return row.id;
}

const createMortgageForPropertySchema = z.object({
  assetId: z.string().uuid(),
});

// Attaches a mortgage (liability + repayment expense) to an existing property.
// The repayment expense owns the payment amount; timing lives on the liability.
export async function createMortgageForProperty(input: {
  assetId: string;
}): Promise<string> {
  const userId = await requireUserId();
  const { assetId } = createMortgageForPropertySchema.parse(input);
  const id = await prisma.$transaction(async (tx) => {
    const property = await tx.planAsset.findFirst({
      where: {
        id: assetId,
        wrapper: "PROPERTY",
        deletedAt: null,
        plan: { userId, deletedAt: null },
      },
      select: { planId: true },
    });
    if (!property) throw new Error("Property not found");

    const maxL = await tx.planLiability.aggregate({
      where: { planId: property.planId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const liability = await tx.planLiability.create({
      data: {
        planId: property.planId,
        label: "Mortgage",
        openingBalance: 0,
        interestPct: 0,
        monthlyRepayment: 0,
        linkedAssetId: assetId,
        sortOrder: (maxL._max.sortOrder ?? -1) + 1,
      },
    });

    const maxE = await tx.planExpense.aggregate({
      where: { planId: property.planId, deletedAt: null },
      _max: { sortOrder: true },
    });
    await tx.planExpense.create({
      data: {
        planId: property.planId,
        label: "Mortgage repayment",
        category: null,
        annualAmount: 0,
        inflationLinked: false,
        liabilityId: liability.id,
        sortOrder: (maxE._max.sortOrder ?? -1) + 1,
      },
    });
    return liability.id;
  });
  revalidatePath("/plan");
  return id;
}

// Creates a fresh property + mortgage + repayment trio; returns the property id
// so the caller can open the shared property card.
export async function createMortgage(): Promise<string> {
  const assetId = await createPlanProperty();
  await createMortgageForProperty({ assetId });
  return assetId;
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
  await prisma.$transaction(async (tx) => {
    const res = await tx.planAsset.updateMany({
      where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
      // The link goes with the row: a tombstone is no longer this plan's
      // mirror of the account, and leaving it linked would make it collide,
      // through @@unique([planId, accountId]), with the row the next Sync
      // adds for that same account.
      data: { deletedAt: new Date(), accountId: null },
    });
    if (res.count === 0) throw new Error("Asset not found");
    // A mortgage cannot outlive its property: cascade the soft delete to the
    // linked liability and its repayment expense.
    const mortgages = await tx.planLiability.findMany({
      where: {
        linkedAssetId: id,
        deletedAt: null,
        plan: { userId, deletedAt: null },
      },
      select: { id: true },
    });
    if (mortgages.length > 0) {
      const ids = mortgages.map((m) => m.id);
      await tx.planLiability.updateMany({
        where: { id: { in: ids }, plan: { userId, deletedAt: null } },
        data: { deletedAt: new Date(), linkedAssetId: null, accountId: null },
      });
      await tx.planExpense.updateMany({
        where: { liabilityId: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date(), categoryId: null },
      });
    }
  });
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
      data: { deletedAt: new Date(), linkedAssetId: null, accountId: null },
    });
    if (res.count === 0) throw new Error("Liability not found");
    // The repayment can't outlive the debt: cascade the soft delete.
    await tx.planExpense.updateMany({
      where: { liabilityId: id, deletedAt: null },
      data: { deletedAt: new Date(), categoryId: null },
    });
  });
  revalidatePath("/plan");
}

export async function deletePlanIncome(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const { id } = deleteRowSchema.parse(input);
  const res = await prisma.planIncome.updateMany({
    where: { id, deletedAt: null, plan: { userId, deletedAt: null } },
    data: { deletedAt: new Date(), categoryId: null },
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
      data: { deletedAt: new Date(), categoryId: null },
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

  if (p.kind === "PROPERTY_SALE") {
    const asset = await prisma.planAsset.findFirst({
      where: {
        id: p.assetId ?? "",
        deletedAt: null,
        plan: { userId, deletedAt: null },
      },
      select: { wrapper: true },
    });
    if (asset?.wrapper !== "PROPERTY")
      throw new Error("Sale must reference a property");
  }

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
      kind: p.kind,
      assetId: p.kind === "PROPERTY_SALE" ? p.assetId : null,
    },
  });
  if (res.count === 0) throw new Error("Event not found");
  revalidatePath("/plan");
}

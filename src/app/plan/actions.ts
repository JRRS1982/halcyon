"use server";

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

export async function createPlan(input: {
  dateOfBirth: string;
  retirementAge: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { dateOfBirth, retirementAge } = createPlanSchema.parse(input);

  // One primary plan per user (v1).
  const existing = await prisma.plan.findFirst({
    where: { userId, isPrimary: true, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/plan");
    return;
  }

  // Seed from the most recent non-deleted month period (balance + budget share it).
  const period = await prisma.financialPeriod.findFirst({
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

  const seeded = seedPlanChildren(balanceItems, financialItems, retirementAge);

  await prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date(dateOfBirth),
      retirementAge,
      statePensionAge: 67,
      statePensionAnnual: 11500,
      assets: { create: seeded.assets },
      liabilities: { create: seeded.liabilities },
      incomes: { create: seeded.incomes },
      expenses: { create: seeded.expenses },
    },
  });

  revalidatePath("/plan");
}

import { z } from "zod";

export const itemTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const expenseCategorySchema = z.enum([
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
]);
export const incomeCategorySchema = z.enum([
  "SALARY",
  "SIDE_INCOME",
  "INVESTMENTS",
  "PENSIONS",
  "OTHER",
]);

export const createItemSchema = z.object({
  periodId: z.string().uuid(),
  type: itemTypeSchema,
  parentItemId: z.string().uuid().nullable(),
  category: expenseCategorySchema.nullable().optional(),
  incomeCategory: incomeCategorySchema.nullable().optional(),
  label: z.string().trim().max(120),
});

export const updateItemSchema = z
  .object({
    itemId: z.string().uuid(),
    label: z.string().trim().max(120).optional(),
    budget: z.number().nonnegative().optional(),
    actual: z.number().nonnegative().optional(),
    category: expenseCategorySchema.optional(),
    incomeCategory: incomeCategorySchema.optional(),
  })
  .refine(
    (patch) =>
      patch.label !== undefined ||
      patch.budget !== undefined ||
      patch.actual !== undefined ||
      patch.category !== undefined ||
      patch.incomeCategory !== undefined,
    { message: "At least one field must be updated" },
  );

export const deleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

export const reparentItemSchema = z.object({
  itemId: z.string().uuid(),
  newParentItemId: z.string().uuid().nullable(),
});

export const copyPeriodFromSchema = z.object({
  sourcePeriodId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

export const saveBudgetTemplateSchema = z.object({
  sourcePeriodId: z.string().uuid(),
});

export const copyBudgetTemplateSchema = z.object({
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemSchema>;
export type ReparentItemInput = z.infer<typeof reparentItemSchema>;
export type CopyPeriodFromInput = z.infer<typeof copyPeriodFromSchema>;
export type SaveBudgetTemplateInput = z.infer<typeof saveBudgetTemplateSchema>;
export type CopyBudgetTemplateInput = z.infer<typeof copyBudgetTemplateSchema>;

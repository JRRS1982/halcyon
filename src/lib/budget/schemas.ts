import { z } from "zod";

export const itemTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "REPAYMENT",
]);
export const transferDirectionSchema = z.enum(["INFLOW", "OUTFLOW"]);
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

// A TRANSFER or REPAYMENT is anchored to an account, never to a category; a
// TRANSFER additionally carries a direction, a REPAYMENT never does — it is
// always inward to the debt. The target's Account.kind is checked in the
// action, which is the only layer that can read it.
const anchorInvariants = <
  T extends {
    type: z.infer<typeof itemTypeSchema>;
    accountId?: string | null;
    direction?: "INFLOW" | "OUTFLOW" | null;
  },
>(
  v: T,
  ctx: z.RefinementCtx,
): void => {
  const needsAccount = v.type === "TRANSFER" || v.type === "REPAYMENT";
  if (needsAccount && !v.accountId)
    ctx.addIssue({ code: "custom", message: `${v.type} needs an accountId` });
  if (!needsAccount && v.accountId)
    ctx.addIssue({
      code: "custom",
      message: `${v.type} cannot carry an accountId`,
    });
  if (v.type === "TRANSFER" && !v.direction)
    ctx.addIssue({ code: "custom", message: "TRANSFER needs a direction" });
  if (v.type !== "TRANSFER" && v.direction)
    ctx.addIssue({
      code: "custom",
      message: `${v.type} cannot carry a direction`,
    });
};

export const createItemSchema = z
  .object({
    periodId: z.string().uuid(),
    type: itemTypeSchema,
    category: expenseCategorySchema.nullable().optional(),
    incomeCategory: incomeCategorySchema.nullable().optional(),
    label: z.string().trim().max(120),
    accountId: z.string().uuid().nullable().optional(),
    direction: transferDirectionSchema.nullable().optional(),
  })
  .superRefine(anchorInvariants);

// The sheet's "+ Income" / "+ Expense" buttons, which address the period by
// month rather than id — the row may be the first thing in a month that has no
// FinancialPeriod row yet.
export const createItemForMonthSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(0).max(11),
    type: itemTypeSchema,
    category: expenseCategorySchema.nullable().optional(),
    incomeCategory: incomeCategorySchema.nullable().optional(),
    label: z.string().trim().max(120),
    accountId: z.string().uuid().nullable().optional(),
    direction: transferDirectionSchema.nullable().optional(),
  })
  .superRefine(anchorInvariants);

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

export const copyPeriodFromSchema = z.object({
  sourcePeriodId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type CreateItemForMonthInput = z.infer<typeof createItemForMonthSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemSchema>;
export type CopyPeriodFromInput = z.infer<typeof copyPeriodFromSchema>;

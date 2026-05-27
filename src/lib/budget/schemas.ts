import { z } from "zod";

export const itemTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const expenseCategorySchema = z.enum([
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
]);

export const createItemSchema = z.object({
  periodId: z.string().uuid(),
  type: itemTypeSchema,
  parentItemId: z.string().uuid().nullable(),
  category: expenseCategorySchema.nullable().optional(),
  label: z.string().trim().max(120),
});

export const updateItemSchema = z
  .object({
    itemId: z.string().uuid(),
    label: z.string().trim().max(120).optional(),
    budget: z.number().nonnegative().optional(),
    actual: z.number().nonnegative().optional(),
    category: expenseCategorySchema.optional(),
  })
  .refine(
    (patch) =>
      patch.label !== undefined ||
      patch.budget !== undefined ||
      patch.actual !== undefined ||
      patch.category !== undefined,
    { message: "At least one field must be updated" },
  );

export const deleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

export const reparentItemSchema = z.object({
  itemId: z.string().uuid(),
  newParentItemId: z.string().uuid().nullable(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemSchema>;
export type ReparentItemInput = z.infer<typeof reparentItemSchema>;

import { z } from "zod";

export const itemTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const createItemSchema = z.object({
  periodId: z.string().uuid(),
  type: itemTypeSchema,
  parentItemId: z.string().uuid().nullable(),
  label: z.string().trim().min(1, "Label is required").max(120),
});

export const updateItemSchema = z
  .object({
    itemId: z.string().uuid(),
    label: z.string().trim().max(120).optional(),
    budget: z.number().nonnegative().optional(),
    actual: z.number().nonnegative().optional(),
  })
  .refine(
    (patch) =>
      patch.label !== undefined ||
      patch.budget !== undefined ||
      patch.actual !== undefined,
    { message: "At least one field must be updated" },
  );

export const deleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemSchema>;

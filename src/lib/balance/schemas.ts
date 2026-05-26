import { z } from "zod";

export const balanceItemTypeSchema = z.enum(["ASSET", "LIABILITY"]);
export const balanceItemCategorySchema = z.enum([
  "CURRENT",
  "LONG_TERM",
  "OTHER",
]);

export const createBalanceItemSchema = z.object({
  periodId: z.string().uuid(),
  type: balanceItemTypeSchema,
  category: balanceItemCategorySchema,
  label: z.string().trim().max(120),
});

export const updateBalanceItemSchema = z
  .object({
    itemId: z.string().uuid(),
    label: z.string().trim().max(120).optional(),
    value: z.number().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (patch) =>
      patch.label !== undefined ||
      patch.value !== undefined ||
      patch.notes !== undefined,
    { message: "At least one field must be updated" },
  );

export const deleteBalanceItemSchema = z.object({
  itemId: z.string().uuid(),
});

export type CreateBalanceItemInput = z.infer<typeof createBalanceItemSchema>;
export type UpdateBalanceItemInput = z.infer<typeof updateBalanceItemSchema>;
export type DeleteBalanceItemInput = z.infer<typeof deleteBalanceItemSchema>;

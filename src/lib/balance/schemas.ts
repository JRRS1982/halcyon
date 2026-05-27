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

export const moveBalanceItemSchema = z.object({
  itemId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const setBalanceItemSectionSchema = z.object({
  itemId: z.string().uuid(),
  type: balanceItemTypeSchema,
  category: balanceItemCategorySchema,
});

export const copyBalancePeriodFromSchema = z.object({
  sourcePeriodId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

export const saveBalanceTemplateSchema = z.object({
  sourcePeriodId: z.string().uuid(),
});

export const copyBalanceTemplateSchema = z.object({
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

export type CreateBalanceItemInput = z.infer<typeof createBalanceItemSchema>;
export type UpdateBalanceItemInput = z.infer<typeof updateBalanceItemSchema>;
export type DeleteBalanceItemInput = z.infer<typeof deleteBalanceItemSchema>;
export type MoveBalanceItemInput = z.infer<typeof moveBalanceItemSchema>;
export type SetBalanceItemSectionInput = z.infer<
  typeof setBalanceItemSectionSchema
>;
export type CopyBalancePeriodFromInput = z.infer<
  typeof copyBalancePeriodFromSchema
>;
export type SaveBalanceTemplateInput = z.infer<
  typeof saveBalanceTemplateSchema
>;
export type CopyBalanceTemplateInput = z.infer<
  typeof copyBalanceTemplateSchema
>;

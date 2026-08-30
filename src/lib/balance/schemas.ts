import { z } from "zod";

export const balanceItemTypeSchema = z.enum(["ASSET", "LIABILITY"]);
export const balanceItemCategorySchema = z.enum([
  "CURRENT",
  "MEDIUM_TERM",
  "LONG_TERM",
  "PROPERTY",
  "OTHER",
]);

export const createBalanceItemSchema = z.object({
  periodId: z.string().uuid(),
  type: balanceItemTypeSchema,
  category: balanceItemCategorySchema,
  label: z.string().trim().max(120),
});

export const copyBalancePeriodFromSchema = z.object({
  sourcePeriodId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

// Verbatim order per the global constraints — the fourteen account types the
// user can move an account between (same-kind moves only; setAccountType
// enforces that).
export const accountTypeSchema = z.enum([
  "CURRENT_ACCOUNT",
  "SAVINGS",
  "CASH_ISA",
  "STOCKS_ISA",
  "SIPP",
  "FINAL_SALARY",
  "GIA",
  "PROPERTY",
  "OTHER_ASSET",
  "MORTGAGE",
  "CREDIT_CARD",
  "LOAN",
  "OVERDRAFT",
  "OTHER_DEBT",
]);

export const setAccountTypeSchema = z.object({
  accountId: z.string().uuid(),
  type: accountTypeSchema,
});

export const setAccountSectionSchema = z.object({
  accountId: z.string().uuid(),
  section: balanceItemCategorySchema,
});

export const renameAccountSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const upsertBalanceValueSchema = z
  .object({
    accountId: z.string().uuid(),
    year: z.number().int(),
    month: z.number().int().min(0).max(11),
    value: z.number().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((patch) => patch.value !== undefined || patch.notes !== undefined, {
    message: "At least one field must be updated",
  });

export const clearBalanceValueSchema = z.object({
  accountId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
});

export type CreateBalanceItemInput = z.infer<typeof createBalanceItemSchema>;
export type CopyBalancePeriodFromInput = z.infer<
  typeof copyBalancePeriodFromSchema
>;
export type SetAccountTypeInput = z.infer<typeof setAccountTypeSchema>;
export type SetAccountSectionInput = z.infer<typeof setAccountSectionSchema>;
export type RenameAccountInput = z.infer<typeof renameAccountSchema>;
export type UpsertBalanceValueInput = z.infer<typeof upsertBalanceValueSchema>;
export type ClearBalanceValueInput = z.infer<typeof clearBalanceValueSchema>;

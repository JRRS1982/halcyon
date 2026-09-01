import type { AccountType } from "@prisma/client";
import { z } from "zod";

export const accountSectionSchema = z.enum([
  "CURRENT",
  "MEDIUM_TERM",
  "LONG_TERM",
  "PROPERTY",
  "OTHER",
]);

export const copyBalancePeriodFromSchema = z.object({
  sourcePeriodId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(0).max(11),
});

// Compile-time exhaustiveness: adding a 15th AccountType fails here until
// the schema learns it — an omitted value would otherwise be silently
// unselectable.
const ALL_ACCOUNT_TYPES = {
  CURRENT_ACCOUNT: true,
  SAVINGS: true,
  CASH_ISA: true,
  STOCKS_ISA: true,
  SIPP: true,
  FINAL_SALARY: true,
  GIA: true,
  PROPERTY: true,
  OTHER_ASSET: true,
  MORTGAGE: true,
  CREDIT_CARD: true,
  LOAN: true,
  OVERDRAFT: true,
  OTHER_DEBT: true,
} satisfies Record<AccountType, true>;
export const accountTypeSchema = z.enum(
  Object.keys(ALL_ACCOUNT_TYPES) as [AccountType, ...AccountType[]],
);

export const setAccountTypeSchema = z.object({
  accountId: z.string().uuid(),
  type: accountTypeSchema,
});

export const setAccountSectionSchema = z.object({
  accountId: z.string().uuid(),
  section: accountSectionSchema,
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

export type CopyBalancePeriodFromInput = z.infer<
  typeof copyBalancePeriodFromSchema
>;
export type SetAccountTypeInput = z.infer<typeof setAccountTypeSchema>;
export type SetAccountSectionInput = z.infer<typeof setAccountSectionSchema>;
export type RenameAccountInput = z.infer<typeof renameAccountSchema>;
export type UpsertBalanceValueInput = z.infer<typeof upsertBalanceValueSchema>;
export type ClearBalanceValueInput = z.infer<typeof clearBalanceValueSchema>;

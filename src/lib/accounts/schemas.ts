import { z } from "zod";
import {
  balanceItemCategorySchema,
  balanceItemTypeSchema,
} from "@/lib/balance/schemas";

export const accountWrapperSchema = z.enum([
  "PENSION",
  "ISA",
  "GIA",
  "CASH",
  "PROPERTY",
  "DB_PENSION",
  "OTHER",
]);

// One gesture creates the account and its first observation, so the drawer's
// payload carries both. `mortgage` is present only for a property with a debt
// on it, and creates the second account plus the link in the same transaction.
export const createAccountWithBalanceSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(0).max(11),
    name: z.string().trim().min(1).max(120),
    type: balanceItemTypeSchema,
    category: balanceItemCategorySchema,
    wrapper: accountWrapperSchema,
    value: z.number(),
    canImportTransactions: z.boolean(),
    mortgage: z
      .object({
        name: z.string().trim().min(1).max(120),
        value: z.number(),
        canImportTransactions: z.boolean(),
      })
      .nullable()
      .default(null),
  })
  // A mortgage only makes sense attached to a property asset — the action
  // always files it under LONG_TERM liabilities regardless of `category`, so
  // any other combination is a client bug, not a valid shape.
  .refine(
    (input) =>
      !input.mortgage ||
      (input.type === "ASSET" && input.category === "PROPERTY"),
    {
      message: "A mortgage can only be attached to a PROPERTY asset",
      path: ["mortgage"],
    },
  );

export const accountIdSchema = z.object({ accountId: z.string().uuid() });

export const deleteAccountEverywhereSchema = accountIdSchema.extend({
  // The linked property or mortgage goes too. Always an explicit choice —
  // never inferred, never hidden when a link exists.
  alsoLinked: z.boolean(),
});

export type CreateAccountWithBalanceInput = z.infer<
  typeof createAccountWithBalanceSchema
>;
export type AccountIdInput = z.infer<typeof accountIdSchema>;
export type DeleteAccountEverywhereInput = z.infer<
  typeof deleteAccountEverywhereSchema
>;

export type AccountDeletionCounts = {
  months: number;
  budgetRows: number;
  transactions: number;
  importBatches: number;
  linked: { accountId: string; name: string; latestValue: number } | null;
};

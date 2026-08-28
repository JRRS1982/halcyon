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

// Archiving carries the same choice as deleting: a mortgage on a property you
// have stopped tracking should not carry on appearing by itself.
export const archiveAccountSchema = accountIdSchema.extend({
  alsoLinked: z.boolean(),
  // The month the user is looking at when they stop tracking. Rows from this
  // month on go; earlier ones are observations that were true when they were
  // made. Taken from the sheet rather than from the clock, so the row leaves
  // the sheet the button was on.
  fromYear: z.number().int(),
  fromMonth: z.number().int().min(0).max(11),
});

export const deleteAccountEverywhereSchema = accountIdSchema.extend({
  // The linked property or mortgage goes too. Always an explicit choice —
  // never inferred, never hidden when a link exists.
  alsoLinked: z.boolean(),
});

export type CreateAccountWithBalanceInput = z.infer<
  typeof createAccountWithBalanceSchema
>;
export type AccountIdInput = z.infer<typeof accountIdSchema>;
export type ArchiveAccountInput = z.infer<typeof archiveAccountSchema>;
export type DeleteAccountEverywhereInput = z.infer<
  typeof deleteAccountEverywhereSchema
>;

export type AccountDeletionCounts = {
  months: number;
  budgetRows: number;
  transactions: number;
  importBatches: number;
  // The linked property/mortgage's own rows — deleteAccountEverywhere with
  // alsoLinked:true destroys these too, so a caller stating the size of that
  // delete needs them alongside the primary account's counts above.
  linked: {
    accountId: string;
    name: string;
    latestValue: number;
    months: number;
    budgetRows: number;
    transactions: number;
    importBatches: number;
  } | null;
};

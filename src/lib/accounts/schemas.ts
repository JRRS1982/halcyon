import { z } from "zod";
import {
  accountTypeSchema,
  balanceItemCategorySchema,
} from "@/lib/balance/schemas";

// One gesture creates the account and its first observation, so the drawer's
// payload carries both. The account is described by the one `type` the drawer
// already asks for plus the `section` it files under — kind and wrapper are
// derived from the type (kindOf/wrapperOf), never sent. `mortgage` is present
// only for a property with a debt on it, and creates the second account plus
// the link in the same transaction.
export const createAccountSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(0).max(11),
    name: z.string().trim().min(1).max(120),
    type: accountTypeSchema,
    section: balanceItemCategorySchema,
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
  // A mortgage only makes sense attached to a property — the action always
  // files it under LONG_TERM liabilities regardless of `section`, so any
  // other combination is a client bug, not a valid shape.
  .refine((input) => !input.mortgage || input.type === "PROPERTY", {
    message: "A mortgage can only be attached to a PROPERTY asset",
    path: ["mortgage"],
  });

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

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
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

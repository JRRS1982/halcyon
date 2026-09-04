import { z } from "zod";
import { accountSectionSchema, accountTypeSchema } from "@/lib/balance/schemas";

// Every parameter is optional and nullable, and the two mean different things:
// absent = "don't touch this", null = "clear it, take the default". The card
// sends only the fields its account type prompts for, so absent is the normal
// case for the other eight.
//
// DECIMAL(5,2) tops out at 999.99, so the rate bounds are the column's, not a
// judgement about plausible interest. annualIncome is DECIMAL(12,2).
const pct = z.number().min(-999.99).max(999.99);

export const accountTermsSchema = z.object({
  expectedReturnPct: pct.nullish(),
  feePct: pct.nullish(),
  minAccessAge: z.number().int().min(0).max(120).nullish(),
  annualIncome: z.number().min(0).max(9_999_999_999.99).nullish(),
  interestPct: pct.nullish(),
  interestOnly: z.boolean().optional(),
  revisionDate: z.coerce.date().nullish(),
  revisionRate: pct.nullish(),
  endDate: z.coerce.date().nullish(),
});

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
    section: accountSectionSchema,
    value: z.number(),
    canImportTransactions: z.boolean(),
    // Empty when the drawer's advanced section was left alone, which is the
    // common case — the action then writes no terms row at all.
    terms: accountTermsSchema.default({}),
    mortgage: z
      .object({
        name: z.string().trim().min(1).max(120),
        value: z.number(),
        canImportTransactions: z.boolean(),
        terms: accountTermsSchema.default({}),
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

export const setAccountTermsSchema = accountIdSchema.extend({
  terms: accountTermsSchema,
});

export type AccountTermsInput = z.infer<typeof accountTermsSchema>;
export type SetAccountTermsInput = z.infer<typeof setAccountTermsSchema>;

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

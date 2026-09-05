import type { AccountType } from "@prisma/client";
import { z } from "zod";
import { type TermField, termsFor } from "@/lib/accounts/accountDraft";
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

/**
 * The parameters in `terms` that this account type does not prompt for.
 *
 * accountTermsSchema deliberately accepts all nine for any account — it is one
 * shape, and *which* of the nine an account may carry is declared by
 * `termsFor(type)`, not by the schema. This turns that declaration into
 * something an action can refuse with: a value typed under one type and
 * submitted under another (the Add drawer's picker changed after the Advanced
 * section was filled in, or a hand-rolled payload) would otherwise be stored
 * where no card renders it and no gesture can clear it.
 *
 * `undefined` is not a value: absent means "don't touch this", so a payload
 * carrying an explicit `undefined` for a parameter it is not offering is not
 * offering it. `null` is — clearing a parameter the type never prompts for is
 * as meaningless as setting one.
 */
export function disallowedTerms(
  type: AccountType,
  terms: AccountTermsInput,
): TermField[] {
  const allowed = new Set<TermField>(termsFor(type));
  return (Object.entries(terms) as [TermField, unknown][])
    .filter(([field, value]) => value !== undefined && !allowed.has(field))
    .map(([field]) => field);
}

/**
 * `terms` narrowed to the parameters `type` prompts for, and nothing else.
 *
 * What the card and the Add drawer send. The value they hold is the whole
 * AccountTerms row — nine keys, most of them null — and spreading that
 * straight into a payload would offer parameters the type does not prompt
 * for, including one stranded by an earlier type change. Narrowing here means
 * the client sends exactly what it rendered, which is what `disallowedTerms`
 * insists on server-side.
 *
 * Derived from `termsFor` rather than nine hand-written lines: a tenth column
 * declared there is picked up here for free, rather than silently omitted.
 */
export function promptedTerms(
  type: AccountType,
  terms: AccountTermsInput,
): AccountTermsInput {
  const entries = termsFor(type).map((field) => [field, terms[field]]);
  // Object.fromEntries erases the per-key value types; every entry above is
  // one of AccountTermsInput's own keys paired with its own value, so the
  // shape is right by construction.
  return Object.fromEntries(entries) as AccountTermsInput;
}

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

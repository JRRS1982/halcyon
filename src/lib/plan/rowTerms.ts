/**
 * The parameters Sync compares, in the units the plan stores them in.
 *
 * Dates are absent on purpose: AccountTerms holds `revisionDate` and `endDate`
 * as dates, the plan holds ages, and a date compared against an age reports a
 * change on every Sync forever. The conversion happens in reality.ts, before
 * anything reaches here.
 */
export type RowTerms = {
  expectedReturnPct: number | null;
  feePct: number | null;
  minAccessAge: number | null;
  annualIncome: number | null;
  incomeFromAge: number | null;
  interestPct: number | null;
  interestOnly: boolean;
  revisionRate: number | null;
  revisionAge: number | null;
  endAge: number | null;
};

// The exhaustiveness pin. `satisfies Record<keyof RowTerms, true>` genuinely
// forces every key of RowTerms to appear here — unlike `satisfies readonly
// (keyof RowTerms)[]` on an array, which only checks that the keys *listed*
// are valid and happily compiles with keys missing. A field added to RowTerms
// and not added here fails the build (TS1360, "Property '<field>' is
// missing"); the same repo idiom as accountTypeSchema deriving from
// ALL_ACCOUNT_TYPES in src/lib/balance/schemas.ts.
const ALL_TERM_KEYS = {
  expectedReturnPct: true,
  feePct: true,
  minAccessAge: true,
  annualIncome: true,
  incomeFromAge: true,
  interestPct: true,
  interestOnly: true,
  revisionRate: true,
  revisionAge: true,
  endAge: true,
} satisfies Record<keyof RowTerms, true>;

/**
 * Every key of RowTerms, derived from the pin above rather than listed a
 * second time — a second list is exactly how a real defect got shipped
 * during this task's own review: a hand-written array only checks that what
 * it lists is valid, not that nothing is missing, so a forgotten key would
 * compile clean and rowTermsEqual would silently stop comparing it forever.
 * Deriving here means there is one place to add a field, and the compiler
 * enforces it.
 */
export const TERM_COMPARE_KEYS = Object.keys(
  ALL_TERM_KEYS,
) as (keyof RowTerms)[];

export const emptyRowTerms = (): RowTerms => ({
  expectedReturnPct: null,
  feePct: null,
  minAccessAge: null,
  annualIncome: null,
  incomeFromAge: null,
  interestPct: null,
  interestOnly: false,
  revisionRate: null,
  revisionAge: null,
  endAge: null,
});

export const rowTermsEqual = (a: RowTerms, b: RowTerms): boolean =>
  TERM_COMPARE_KEYS.every((key) => a[key] === b[key]);

/**
 * The age the user reaches in the calendar year of `date`. Whole years,
 * matching every other age the projection uses — the engine steps a year at a
 * time, so a month-precise age would be spurious precision that also broke the
 * equality comparison.
 */
export const ageOnDate = (
  dateOfBirth: Date,
  date: Date | null,
): number | null =>
  date === null
    ? null
    : new Date(date).getUTCFullYear() - new Date(dateOfBirth).getUTCFullYear();

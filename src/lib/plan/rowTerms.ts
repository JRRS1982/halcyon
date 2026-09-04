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

/**
 * Every key of RowTerms, pinned exhaustive. rowTermsEqual iterates this rather
 * than reading fields by hand, so a parameter added to RowTerms is compared
 * automatically and the `satisfies` below fails the build if it is not listed.
 * This is the structural defence against a value that quietly stops travelling.
 */
export const TERM_COMPARE_KEYS = [
  "expectedReturnPct",
  "feePct",
  "minAccessAge",
  "annualIncome",
  "incomeFromAge",
  "interestPct",
  "interestOnly",
  "revisionRate",
  "revisionAge",
  "endAge",
] as const satisfies readonly (keyof RowTerms)[];

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

// Referenced so the exhaustiveness pin is not dead code.
void ALL_TERM_KEYS;

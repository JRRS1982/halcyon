// What a brand-new account starts with: a category taxonomy and the accounts
// most households actually hold. Pure data, no Prisma import, so the shape is
// unit-testable and both consumers read from one list — the provisioning path
// (src/lib/settings/server.ts) and the backfill migration that fills in users
// who signed up before this existed.
//
// Why defaults at all: every page except the marketing site is a wall of empty
// state on first sign-in, and the two things you cannot do anything without —
// somewhere for money to sit, and a name to file spending under — are exactly
// the two the app used to ask you to invent from scratch.

import type { ExpenseBucket, IncomeBucket } from "@/lib/categories/buckets";

export type DefaultCategory = {
  label: string;
  type: "INCOME" | "EXPENSE";
  bucket: ExpenseBucket | IncomeBucket;
  // Whether this category is also written as a £0 row on the first budget
  // sheet. Only the lines nearly every household has every month are, so the
  // sheet opens as a page you fill in rather than a wall to scroll past. The
  // rest are still in every picker, and appear on the sheet by themselves the
  // first month a transaction lands in one — see the backfill in
  // src/app/(app)/budget/page.tsx, which pulls in any category with activity.
  inStarterBudget?: true;
};

// Order here is the order everywhere: `sortOrder` is the array index, which
// drives the Settings list and the pickers.
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // ─── Income ───────────────────────────────────────────────────────────────
  {
    label: "Salary",
    type: "INCOME",
    bucket: "SALARY",
    inStarterBudget: true,
  },
  {
    label: "Side Income",
    type: "INCOME",
    bucket: "SIDE_INCOME",
    inStarterBudget: true,
  },
  { label: "Investment Income", type: "INCOME", bucket: "INVESTMENTS" },
  { label: "Pension Income", type: "INCOME", bucket: "PENSIONS" },
  { label: "Benefits & Child Benefit", type: "INCOME", bucket: "OTHER" },
  { label: "Rental Income", type: "INCOME", bucket: "OTHER" },
  { label: "Other Income", type: "INCOME", bucket: "OTHER" },

  // ─── Fixed expenses ───────────────────────────────────────────────────────
  // Bills that arrive whether or not you change your behaviour this month.
  {
    label: "Rent / Mortgage",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Council Tax",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Utilities",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  // Separate from Utilities: billed on its own cycle by a different supplier,
  // so a combined line can never be reconciled against either bill.
  { label: "Water", type: "EXPENSE", bucket: "FIXED" },
  {
    label: "Phone & Internet",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  { label: "TV Licence", type: "EXPENSE", bucket: "FIXED" },
  {
    label: "Insurance",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Subscriptions",
    type: "EXPENSE",
    bucket: "FIXED",
    inStarterBudget: true,
  },
  { label: "Childcare", type: "EXPENSE", bucket: "FIXED" },
  { label: "School & Education", type: "EXPENSE", bucket: "FIXED" },
  // Repayments to an outside lender are spending. Paying off a credit card you
  // hold as an Account is not — that is a transfer between your own accounts,
  // and filing it here would count the original purchases twice.
  { label: "Loan Repayments", type: "EXPENSE", bucket: "FIXED" },

  // ─── Variable expenses ────────────────────────────────────────────────────
  // Necessary, but the amount moves with how the month goes.
  {
    label: "Groceries",
    type: "EXPENSE",
    bucket: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Household & Cleaning", type: "EXPENSE", bucket: "VARIABLE" },
  {
    label: "Fuel",
    type: "EXPENSE",
    bucket: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Public Transport", type: "EXPENSE", bucket: "VARIABLE" },
  { label: "Parking & Tolls", type: "EXPENSE", bucket: "VARIABLE" },
  // Tax, MOT, servicing, repairs — the annualised cost of running the car,
  // as distinct from the fuel you put in it.
  { label: "Motoring", type: "EXPENSE", bucket: "VARIABLE" },
  { label: "Health & Medical", type: "EXPENSE", bucket: "VARIABLE" },
  { label: "Fitness", type: "EXPENSE", bucket: "VARIABLE" },
  {
    label: "Home & Maintenance",
    type: "EXPENSE",
    bucket: "VARIABLE",
    inStarterBudget: true,
  },
  {
    label: "Clothing",
    type: "EXPENSE",
    bucket: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Personal Care", type: "EXPENSE", bucket: "VARIABLE" },
  { label: "Pets", type: "EXPENSE", bucket: "VARIABLE" },
  { label: "Kids' Activities", type: "EXPENSE", bucket: "VARIABLE" },
  // Somewhere for an imported row to go when none of the above fits, so
  // "uncategorised" never has to mean "unfiled".
  { label: "Other Expenses", type: "EXPENSE", bucket: "VARIABLE" },

  // ─── Discretionary expenses ───────────────────────────────────────────────
  // What you would cut first. Split finely because "eating out" is several
  // different habits with different fixes.
  //
  // A caveat that belongs with the data, not the docs: a supermarket shop
  // arrives from a bank statement as one total, so wine and meal deals stay
  // inside Groceries. Alcohol and Coffee & Snacks capture what is bought on
  // its own — the off-licence, the pub, the coffee shop.
  {
    label: "Meals Out",
    type: "EXPENSE",
    bucket: "DISCRETIONARY",
    inStarterBudget: true,
  },
  {
    label: "Takeaways & Fast Food",
    type: "EXPENSE",
    bucket: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Coffee & Snacks", type: "EXPENSE", bucket: "DISCRETIONARY" },
  { label: "Alcohol", type: "EXPENSE", bucket: "DISCRETIONARY" },
  {
    label: "Entertainment",
    type: "EXPENSE",
    bucket: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Hobbies & Sport", type: "EXPENSE", bucket: "DISCRETIONARY" },
  {
    label: "Holidays",
    type: "EXPENSE",
    bucket: "DISCRETIONARY",
    inStarterBudget: true,
  },
  {
    label: "Gifts",
    type: "EXPENSE",
    bucket: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Charity", type: "EXPENSE", bucket: "DISCRETIONARY" },
];

// `type` is deliberately left unset: the Settings account form doesn't collect
// one, so a default carrying a type would be a row the user can see but not
// edit. Nothing infers one from it either — a Sync reads the wrapper and term
// bucket the user actually stated on the account (src/lib/plan/reality.ts and
// realityDefaults.ts), and an account with neither takes the OTHER fallback.
//
// Savings and Emergency Fund are both here on purpose. They hold money for
// opposite reasons — one is for something you have chosen, the other for
// something choosing you — and keeping them apart is the point of an emergency
// fund.
export const DEFAULT_ACCOUNTS: readonly string[] = [
  "Current Account",
  "Joint Account",
  "Savings Account",
  "Emergency Fund Account",
  "ISA",
  "SIPP",
];

// The subset written onto the first budget sheet, in list order.
export const STARTER_BUDGET_CATEGORIES: readonly DefaultCategory[] =
  DEFAULT_CATEGORIES.filter((c) => c.inStarterBudget);

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

import type { AccountType } from "@prisma/client";
import type { CategorySection } from "@/lib/categories/sections";

export type DefaultCategory = {
  label: string;
  type: "INCOME" | "EXPENSE";
  section: CategorySection;
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
    section: "SALARY",
    inStarterBudget: true,
  },
  {
    label: "Side Income",
    type: "INCOME",
    section: "SIDE_INCOME",
    inStarterBudget: true,
  },
  { label: "Investment Income", type: "INCOME", section: "INVESTMENTS" },
  { label: "Pension Income", type: "INCOME", section: "PENSIONS" },
  { label: "Benefits & Child Benefit", type: "INCOME", section: "OTHER" },
  { label: "Rental Income", type: "INCOME", section: "OTHER" },
  { label: "Other Income", type: "INCOME", section: "OTHER" },

  // ─── Fixed expenses ───────────────────────────────────────────────────────
  // Bills that arrive whether or not you change your behaviour this month.
  {
    label: "Rent / Mortgage",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Council Tax",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Utilities",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  // Separate from Utilities: billed on its own cycle by a different supplier,
  // so a combined line can never be reconciled against either bill.
  { label: "Water", type: "EXPENSE", section: "FIXED" },
  {
    label: "Phone & Internet",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  { label: "TV Licence", type: "EXPENSE", section: "FIXED" },
  {
    label: "Insurance",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  {
    label: "Subscriptions",
    type: "EXPENSE",
    section: "FIXED",
    inStarterBudget: true,
  },
  { label: "Childcare", type: "EXPENSE", section: "FIXED" },
  { label: "School & Education", type: "EXPENSE", section: "FIXED" },
  // Repayments to an outside lender are spending. Paying off a credit card you
  // hold as an Account is not — that is a transfer between your own accounts,
  // and filing it here would count the original purchases twice.
  { label: "Loan Repayments", type: "EXPENSE", section: "FIXED" },

  // ─── Variable expenses ────────────────────────────────────────────────────
  // Necessary, but the amount moves with how the month goes.
  {
    label: "Groceries",
    type: "EXPENSE",
    section: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Household & Cleaning", type: "EXPENSE", section: "VARIABLE" },
  {
    label: "Fuel",
    type: "EXPENSE",
    section: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Public Transport", type: "EXPENSE", section: "VARIABLE" },
  { label: "Parking & Tolls", type: "EXPENSE", section: "VARIABLE" },
  // Tax, MOT, servicing, repairs — the annualised cost of running the car,
  // as distinct from the fuel you put in it.
  { label: "Motoring", type: "EXPENSE", section: "VARIABLE" },
  { label: "Health & Medical", type: "EXPENSE", section: "VARIABLE" },
  { label: "Fitness", type: "EXPENSE", section: "VARIABLE" },
  {
    label: "Home & Maintenance",
    type: "EXPENSE",
    section: "VARIABLE",
    inStarterBudget: true,
  },
  {
    label: "Clothing",
    type: "EXPENSE",
    section: "VARIABLE",
    inStarterBudget: true,
  },
  { label: "Personal Care", type: "EXPENSE", section: "VARIABLE" },
  { label: "Pets", type: "EXPENSE", section: "VARIABLE" },
  { label: "Kids' Activities", type: "EXPENSE", section: "VARIABLE" },
  // Somewhere for an imported row to go when none of the above fits, so
  // "uncategorised" never has to mean "unfiled".
  { label: "Other Expenses", type: "EXPENSE", section: "VARIABLE" },

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
    section: "DISCRETIONARY",
    inStarterBudget: true,
  },
  {
    label: "Takeaways & Fast Food",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Coffee & Snacks", type: "EXPENSE", section: "DISCRETIONARY" },
  { label: "Alcohol", type: "EXPENSE", section: "DISCRETIONARY" },
  {
    label: "Entertainment",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Hobbies & Sport", type: "EXPENSE", section: "DISCRETIONARY" },
  {
    label: "Holidays",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    inStarterBudget: true,
  },
  {
    label: "Gifts",
    type: "EXPENSE",
    section: "DISCRETIONARY",
    inStarterBudget: true,
  },
  { label: "Charity", type: "EXPENSE", section: "DISCRETIONARY" },
];

// Every account now carries a type from the moment it's created — see
// buildAccountData (src/lib/accounts/creation.ts), which every creation path
// (this one included) writes through. seedStarterData spreads
// buildAccountData({ type }) per row, deriving `section`/`kind`/`wrapper` from
// it rather than leaving them unset.
//
// Savings and Emergency Fund are both here on purpose. They hold money for
// opposite reasons — one is for something you have chosen, the other for
// something choosing you — and keeping them apart is the point of an emergency
// fund.
export const DEFAULT_ACCOUNTS: readonly { name: string; type: AccountType }[] =
  [
    { name: "Current Account", type: "CURRENT_ACCOUNT" },
    { name: "Joint Account", type: "CURRENT_ACCOUNT" },
    { name: "Savings Account", type: "SAVINGS" },
    { name: "Emergency Fund Account", type: "SAVINGS" },
    { name: "ISA", type: "STOCKS_ISA" },
    { name: "SIPP", type: "SIPP" },
  ];

// The subset written onto the first budget sheet, in list order.
export const STARTER_BUDGET_CATEGORIES: readonly DefaultCategory[] =
  DEFAULT_CATEGORIES.filter((c) => c.inStarterBudget);

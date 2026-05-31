// The budget sections a category can belong to, mirroring the ItemType buckets
// on FinancialItem. EXPENSE categories use one of the expense buckets, INCOME
// categories one of the income buckets. Shared by the ledger UI (section
// pickers + suggestions), the create-category action, and the server mappers.

export const EXPENSE_BUCKETS = [
  { value: "FIXED", label: "Fixed" },
  { value: "VARIABLE", label: "Variable" },
  { value: "DISCRETIONARY", label: "Discretionary" },
] as const;

export const INCOME_BUCKETS = [
  { value: "SALARY", label: "Salary" },
  { value: "SIDE_INCOME", label: "Side income" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "PENSIONS", label: "Pensions" },
  { value: "OTHER", label: "Other" },
] as const;

export type ExpenseBucket = (typeof EXPENSE_BUCKETS)[number]["value"];
export type IncomeBucket = (typeof INCOME_BUCKETS)[number]["value"];

const SECTION_LABELS: Record<string, string> = {
  FIXED: "Fixed",
  VARIABLE: "Variable",
  DISCRETIONARY: "Discretionary",
  SALARY: "Salary",
  SIDE_INCOME: "Side income",
  INVESTMENTS: "Investments",
  PENSIONS: "Pensions",
  OTHER: "Other",
};

// Human label for a category's section, given its expense/income bucket value
// (either may be null — an un-sectioned category).
export function sectionLabel(bucket: string | null | undefined): string {
  if (!bucket) return "Unsectioned";
  return SECTION_LABELS[bucket] ?? bucket;
}

// Display order for sections: expenses first (Fixed → Variable → Discretionary),
// then income, with OTHER near the end and unsectioned/unknown last. Used to
// group the category list.
const SECTION_ORDER = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
  "SALARY",
  "SIDE_INCOME",
  "INVESTMENTS",
  "PENSIONS",
  "OTHER",
];

export function sectionOrderIndex(bucket: string | null | undefined): number {
  if (!bucket) return SECTION_ORDER.length;
  const index = SECTION_ORDER.indexOf(bucket);
  return index === -1 ? SECTION_ORDER.length : index;
}

const EXPENSE_VALUES: string[] = EXPENSE_BUCKETS.map((b) => b.value);
const INCOME_VALUES: string[] = INCOME_BUCKETS.map((b) => b.value);

// Splits a chosen bucket into the right column for a category's type, ignoring
// a bucket that doesn't belong to the type. Shared by create/update so a
// category's section is stored consistently (Prisma `category` for expenses,
// `incomeCategory` for income).
export function bucketFields(
  type: "INCOME" | "EXPENSE",
  bucket: string | null | undefined,
): { category: ExpenseBucket | null; incomeCategory: IncomeBucket | null } {
  const expense = type === "EXPENSE";
  return {
    category:
      expense && bucket && EXPENSE_VALUES.includes(bucket)
        ? (bucket as ExpenseBucket)
        : null,
    incomeCategory:
      !expense && bucket && INCOME_VALUES.includes(bucket)
        ? (bucket as IncomeBucket)
        : null,
  };
}

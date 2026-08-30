// The section a budget row sits under: the sub-heading on the budget sheet,
// mirrored onto Category (so a category carries its grouping) and onto
// PlanExpense (so the plan colours and totals by it). EXPENSE rows use an
// expense section, INCOME rows an income section; the two value sets do not
// overlap, which is why one enum covers both. Shared by the budget sheet, the
// ledger's category pickers, Settings, onboarding, and the server mappers.

export const EXPENSE_SECTIONS = [
  { value: "FIXED", label: "Fixed" },
  { value: "VARIABLE", label: "Variable" },
  { value: "DISCRETIONARY", label: "Discretionary" },
] as const;

export const INCOME_SECTIONS = [
  { value: "SALARY", label: "Salary" },
  { value: "SIDE_INCOME", label: "Side income" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "PENSIONS", label: "Pensions" },
  { value: "OTHER", label: "Other" },
] as const;

export type ExpenseSection = (typeof EXPENSE_SECTIONS)[number]["value"];
export type IncomeSection = (typeof INCOME_SECTIONS)[number]["value"];
export type CategorySection = ExpenseSection | IncomeSection;

type SectionedType = "INCOME" | "EXPENSE";

export function sectionsFor(type: SectionedType) {
  return type === "EXPENSE" ? EXPENSE_SECTIONS : INCOME_SECTIONS;
}

const EXPENSE_VALUES: readonly string[] = EXPENSE_SECTIONS.map((s) => s.value);

export function isExpenseSection(section: string): section is ExpenseSection {
  return EXPENSE_VALUES.includes(section);
}

// The section a write may store for a row of `type`. A mismatch is a caller
// bug, not a value to quietly drop — the old translation layer nulled it,
// which is how a category could end up "Unsectioned".
export function sectionFor(
  type: SectionedType,
  section: string,
): CategorySection {
  const allowed: readonly string[] = sectionsFor(type).map((s) => s.value);
  if (!allowed.includes(section)) {
    throw new Error(`${section} is not an ${type} section`);
  }
  return section as CategorySection;
}

const ALL_SECTIONS = [...EXPENSE_SECTIONS, ...INCOME_SECTIONS];

// Human label for a section.
export function sectionLabel(section: CategorySection): string {
  return ALL_SECTIONS.find((s) => s.value === section)?.label ?? section;
}

// Display order: expenses first (Fixed → Variable → Discretionary), then
// income, with OTHER last.
export function sectionOrderIndex(section: CategorySection): number {
  return ALL_SECTIONS.findIndex((s) => s.value === section);
}

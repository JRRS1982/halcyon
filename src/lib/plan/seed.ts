import type {
  BalanceItemCategory,
  BalanceItemType,
  ExpenseCategory,
  IncomeCategory,
  ItemType,
  PlanAssetWrapper,
  PlanIncomeKind,
} from "@prisma/client";

export interface SeedBalanceItem {
  id: string;
  type: BalanceItemType;
  category: BalanceItemCategory;
  label: string;
  value: number;
}
export interface SeedFinancialItem {
  type: ItemType;
  incomeCategory: IncomeCategory | null;
  category: ExpenseCategory | null;
  label: string;
  budget: number;
  categoryId: string | null;
}

export interface SeededAsset {
  label: string;
  wrapper: PlanAssetWrapper;
  openingValue: number;
  annualContribution: number;
  drawdownPriority: number;
}
export interface SeededLiability {
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
}
export interface SeededIncome {
  label: string;
  kind: PlanIncomeKind;
  annualAmount: number;
  taxable: boolean;
  growthKind: "INFLATION";
  endAge: number | null;
}
export interface SeededExpense {
  label: string;
  category: ExpenseCategory | null;
  annualAmount: number;
  inflationLinked: boolean;
  categoryId: string | null;
}
export interface SeededChildren {
  assets: SeededAsset[];
  liabilities: SeededLiability[];
  incomes: SeededIncome[];
  expenses: SeededExpense[];
}

const DRAWDOWN_BY_CATEGORY: Record<BalanceItemCategory, number> = {
  CURRENT: 0,
  MEDIUM_TERM: 1,
  LONG_TERM: 2,
  OTHER: 3,
  PROPERTY: 9,
};

// A balance sheet only records a value and a coarse term bucket, not the tax
// wrapper. Infer a sensible wrapper from the label first (an explicit "SIPP" or
// "ISA" beats any bucket guess), then fall back to the term bucket. These are
// starting points — the user edits them in the plan's Assets table.
const WRAPPER_BY_CATEGORY: Record<BalanceItemCategory, PlanAssetWrapper> = {
  CURRENT: "CASH",
  MEDIUM_TERM: "GIA",
  LONG_TERM: "ISA",
  PROPERTY: "PROPERTY",
  OTHER: "OTHER",
};

function inferWrapper(
  label: string,
  category: BalanceItemCategory,
): PlanAssetWrapper {
  const l = label.toLowerCase();
  if (category === "PROPERTY" || /propert|house|home|flat/.test(l))
    return "PROPERTY";
  if (/pension|sipp|retire|drawdown/.test(l)) return "PENSION";
  if (/isa/.test(l)) return "ISA";
  if (/gia|brokerage|shares|stocks/.test(l)) return "GIA";
  if (/cash|savings|deposit|premium bond/.test(l)) return "CASH";
  return WRAPPER_BY_CATEGORY[category];
}

// Likewise the balance sheet carries no APR, so infer a plausible rate from the
// label (a card is dearer than a mortgage), then the bucket. Editable in the
// plan's Liabilities table.
function inferInterestPct(
  label: string,
  category: BalanceItemCategory,
): number {
  const l = label.toLowerCase();
  if (/mortgage/.test(l)) return 4.5;
  if (/credit card|card/.test(l)) return 19.9;
  if (/overdraft/.test(l)) return 20;
  if (/loan|car|finance/.test(l)) return 7;
  if (category === "LONG_TERM") return 4.5;
  if (category === "CURRENT") return 18;
  return 5;
}

const INCOME_KIND_BY_BUCKET: Record<IncomeCategory, PlanIncomeKind> = {
  SALARY: "SALARY",
  PENSIONS: "DB_PENSION",
  SIDE_INCOME: "SELF_EMPLOYMENT",
  INVESTMENTS: "OTHER",
  OTHER: "OTHER",
};

export function seedPlanChildren(
  balanceItems: SeedBalanceItem[],
  financialItems: SeedFinancialItem[],
  retirementAge: number,
): SeededChildren {
  const assets: SeededAsset[] = [];
  const liabilities: SeededLiability[] = [];
  for (const b of balanceItems) {
    // A zero-balance item (e.g. a paid-off credit card) carries no signal into
    // the projection — skip it so it doesn't seed a dead row or a ghost bar on
    // the timeline. The user can always add it back by hand.
    if (b.value <= 0) continue;
    if (b.type === "ASSET") {
      assets.push({
        label: b.label,
        wrapper: inferWrapper(b.label, b.category),
        openingValue: b.value,
        annualContribution: 0,
        drawdownPriority: DRAWDOWN_BY_CATEGORY[b.category],
      });
    } else {
      liabilities.push({
        label: b.label,
        openingBalance: b.value,
        interestPct: inferInterestPct(b.label, b.category),
        monthlyRepayment: 0,
      });
    }
  }

  const incomes: SeededIncome[] = [];
  const expenses: SeededExpense[] = [];
  for (const f of financialItems) {
    // Same reasoning as the zero-value balance items above: a row budgeted at
    // nothing carries no signal into the projection. This matters now a new
    // account's first budget sheet arrives pre-filled with £0 starter rows
    // (src/lib/onboarding/defaults.ts) — seeding those verbatim would open the
    // plan on a table of empty lines.
    if (f.budget <= 0) continue;
    if (f.type === "INCOME") {
      const kind = f.incomeCategory
        ? INCOME_KIND_BY_BUCKET[f.incomeCategory]
        : "OTHER";
      incomes.push({
        label: f.label,
        kind,
        annualAmount: f.budget * 12,
        taxable: true,
        growthKind: "INFLATION",
        endAge: kind === "SALARY" ? retirementAge : null,
      });
    } else {
      expenses.push({
        label: f.label,
        category: f.category,
        annualAmount: f.budget * 12,
        inflationLinked: true,
        categoryId: f.categoryId,
      });
    }
  }

  return { assets, liabilities, incomes, expenses };
}

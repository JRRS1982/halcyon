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
  sourceCategoryId: string | null;
}

export interface SeededAsset {
  label: string;
  wrapper: PlanAssetWrapper;
  openingValue: number;
  annualContribution: number;
  drawdownPriority: number;
  sourceBalanceItemId: string;
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
  sourceCategoryId: string | null;
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
    if (b.type === "ASSET") {
      assets.push({
        label: b.label,
        wrapper: "OTHER",
        openingValue: b.value,
        annualContribution: 0,
        drawdownPriority: DRAWDOWN_BY_CATEGORY[b.category],
        sourceBalanceItemId: b.id,
      });
    } else {
      liabilities.push({
        label: b.label,
        openingBalance: b.value,
        interestPct: 0,
        monthlyRepayment: 0,
      });
    }
  }

  const incomes: SeededIncome[] = [];
  const expenses: SeededExpense[] = [];
  for (const f of financialItems) {
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
        sourceCategoryId: f.sourceCategoryId,
      });
    }
  }

  return { assets, liabilities, incomes, expenses };
}

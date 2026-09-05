// src/lib/plan/streams.ts
import { isEntitled } from "./assets";
import { amountThisYear, isActive } from "./helpers";
import type {
  AssetInput,
  ExpenseInput,
  Growth,
  IncomeInput,
  IncomeKind,
} from "./types";

const growthPctOf = (growth: Growth, inflationPct: number): number => {
  if (growth.kind === "INFLATION") return inflationPct;
  if (growth.kind === "FIXED") return growth.pct;
  return 0;
};

export interface IncomeResult {
  gross: number;
  byKind: Record<string, number>;
  taxableTotal: number;
}

export const activeIncome = (
  incomes: IncomeInput[],
  statePension: { startAge: number; annualAmount: number } | undefined,
  age: number,
  yearsElapsed: number,
  inflationPct: number,
  // Every asset in the plan, unfiltered — project.ts hands its whole list
  // over and the entitlement test happens below, per asset. Defaults to none
  // so every existing call site is unaffected.
  assets: AssetInput[] = [],
  // Fallback conversion age when an entitled asset omits incomeFromAge.
  // Unused unless one of `assets` carries an entitlement.
  retirementAge = 0,
): IncomeResult => {
  const result: IncomeResult = { gross: 0, byKind: {}, taxableTotal: 0 };

  const add = (kind: IncomeKind, amount: number, taxable: boolean) => {
    result.gross += amount;
    result.byKind[kind] = (result.byKind[kind] ?? 0) + amount;
    if (taxable) result.taxableTotal += amount;
  };

  for (const income of incomes) {
    if (!isActive(age, income.startAge, income.endAge)) continue;
    add(
      income.kind,
      amountThisYear(
        income.annualAmount,
        growthPctOf(income.growth, inflationPct),
        yearsElapsed,
      ),
      income.taxable,
    );
  }

  if (statePension && age >= statePension.startAge) {
    add(
      "STATE_PENSION",
      amountThisYear(statePension.annualAmount, inflationPct, yearsElapsed),
      true,
    );
  }

  // A final-salary entitlement — a positive annualIncome, see isEntitled —
  // converts at incomeFromAge and pays, unindexed, to the end of the plan —
  // there is no end age to check, unlike a plain IncomeInput. Tagged
  // DB_PENSION so tax and chart code treat it exactly as an explicit DB
  // pension income stream.
  for (const asset of assets) {
    if (!isEntitled(asset)) continue;
    const fromAge = asset.incomeFromAge ?? retirementAge;
    if (age < fromAge) continue;
    add("DB_PENSION", asset.annualIncome, true);
  }

  return result;
};

export interface ExpenseResult {
  total: number;
  byCategory: Record<string, number>;
}

export const activeExpenses = (
  expenses: ExpenseInput[],
  age: number,
  yearsElapsed: number,
  inflationPct: number,
): ExpenseResult => {
  const result: ExpenseResult = { total: 0, byCategory: {} };
  for (const e of expenses) {
    if (!isActive(age, e.startAge, e.endAge)) continue;
    const amount = e.inflationLinked
      ? amountThisYear(e.annualAmount, inflationPct, yearsElapsed)
      : e.annualAmount;
    const key = e.section ?? "UNCATEGORISED";
    result.byCategory[key] = (result.byCategory[key] ?? 0) + amount;
    result.total += amount;
  }
  return result;
};

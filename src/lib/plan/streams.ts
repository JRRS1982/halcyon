// src/lib/plan/streams.ts
import { amountThisYear, isActive } from "./helpers";
import type { ExpenseInput, Growth, IncomeInput, IncomeKind } from "./types";

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

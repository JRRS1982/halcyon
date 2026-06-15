// src/lib/plan/project.ts
import { contributionTargetId, fundDeficit } from "./assets";
import { amountThisYear, grow, round, sum } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import { incomeTax } from "./tax";
import type {
  AssetInput,
  IncomeInput,
  PlanInput,
  PlanProjection,
  YearProjection,
} from "./types";
import { summarise } from "./verdict";

const SYNTHETIC_CASH: AssetInput[] = [
  {
    id: "cash",
    label: "Cash",
    wrapper: "CASH",
    openingValue: 0,
    drawdownPriority: 0,
  },
];

const projectYears = (input: PlanInput): YearProjection[] => {
  // A plan with no assets gets an implicit cash account so inflows/surplus are
  // never silently lost.
  const runAssets = input.assets.length > 0 ? input.assets : SYNTHETIC_CASH;

  const assetBal: Record<string, number> = {};
  for (const a of runAssets) assetBal[a.id] = a.openingValue;
  const liabBal: Record<string, number> = {};
  for (const l of input.liabilities) liabBal[l.id] = l.openingBalance;

  const years: YearProjection[] = [];

  for (let age = input.currentAge; age <= input.planToAge; age++) {
    const yearsElapsed = age - input.currentAge;

    const income = activeIncome(
      input.incomes,
      input.statePension,
      age,
      yearsElapsed,
      input.inflationPct,
    );
    const incTax = incomeTax(income.taxableTotal, input.taxRatePct);
    const netIncome = income.gross - incTax;

    const expenses = activeExpenses(
      input.expenses,
      age,
      yearsElapsed,
      input.inflationPct,
    );

    const liab = liabilityStep(input.liabilities, liabBal, age);
    Object.assign(liabBal, liab.balances);

    const eventsNet = sum(
      input.events
        .filter((e) => e.age === age)
        .map((e) => (e.direction === "INFLOW" ? e.amount : -e.amount)),
    );

    // Contributions are funded only from the year's operating cash flow; they
    // never force a (taxable) drawdown. If cash flow can't cover the full
    // requested amount, contributions scale down proportionally.
    const preContribCashflow =
      netIncome - expenses.total - liab.repaid + eventsNet;
    const requested = runAssets
      .map((a) => {
        const endAge = a.contributionEndAge ?? input.retirementAge;
        const amount =
          a.annualContribution && age < endAge
            ? amountThisYear(
                a.annualContribution,
                input.inflationPct,
                yearsElapsed,
              )
            : 0;
        return { id: a.id, amount };
      })
      .filter((r) => r.amount > 0);
    const requestedTotal = sum(requested.map((r) => r.amount));
    const contribBudget = Math.max(0, preContribCashflow);
    const factor =
      requestedTotal > 0 ? Math.min(1, contribBudget / requestedTotal) : 0;

    const contributedByAsset: Record<string, number> = {};
    for (const r of requested) {
      const funded = r.amount * factor;
      assetBal[r.id] = (assetBal[r.id] ?? 0) + funded;
      contributedByAsset[r.id] = funded;
    }
    const contributions = requestedTotal * factor;

    const cashflow = preContribCashflow - contributions;

    let withdrawalTax = 0;
    let withdrawals = 0;
    let shortfall = false;
    const withdrawnByAsset: Record<string, number> = {};

    if (cashflow >= 0) {
      const targetId = contributionTargetId(runAssets);
      if (targetId) assetBal[targetId] = (assetBal[targetId] ?? 0) + cashflow;
    } else {
      const fund = fundDeficit(
        runAssets,
        assetBal,
        -cashflow,
        input.taxRatePct,
      );
      Object.assign(assetBal, fund.balances);
      Object.assign(withdrawnByAsset, fund.withdrawnByAsset);
      withdrawalTax = fund.withdrawalTax;
      withdrawals = fund.totalWithdrawn;
      shortfall = fund.shortfall;
    }

    const yearTax = incTax + withdrawalTax;

    for (const a of runAssets) {
      assetBal[a.id] = grow(
        assetBal[a.id] ?? 0,
        a.expectedReturnPct ?? input.defaultReturnPct,
      );
    }

    const assets = runAssets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      value: round(assetBal[a.id] ?? 0),
      contributed: round(contributedByAsset[a.id] ?? 0),
      withdrawn: round(withdrawnByAsset[a.id] ?? 0),
    }));
    const liabilities = input.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      value: round(liabBal[l.id] ?? 0),
    }));
    const liabilitiesTotal = sum(liabilities.map((l) => l.value));
    const netWorth = sum(assets.map((a) => a.value)) - liabilitiesTotal;

    const expensesByCategory: Record<string, number> = {};
    for (const [k, v] of Object.entries(expenses.byCategory))
      expensesByCategory[k] = round(v);
    const incomeByKind: Record<string, number> = {};
    for (const [k, v] of Object.entries(income.byKind))
      incomeByKind[k] = round(v);

    years.push({
      age,
      year: input.startYear + yearsElapsed,
      grossIncome: round(income.gross),
      incomeByKind,
      tax: round(yearTax),
      netIncome: round(netIncome),
      expensesByCategory,
      totalExpenses: round(expenses.total),
      liabilityRepayments: round(liab.repaid),
      surplus: round(cashflow),
      contributions: round(contributions),
      withdrawals: round(withdrawals),
      assets,
      liabilities,
      liabilitiesTotal,
      netWorth: round(netWorth),
      shortfall,
    });
  }

  return years;
};

const EMPLOYMENT: IncomeInput["kind"][] = ["SALARY", "SELF_EMPLOYMENT"];

// Re-runs the projection with employment income ending at each candidate age,
// from currentAge to planToAge, returning the earliest age that keeps the plan
// feasible (or null). Uses projectYears directly, so it never recurses.
export const earliestSustainableRetirementAge = (
  input: PlanInput,
): number | null => {
  for (
    let candidate = input.currentAge;
    candidate <= input.planToAge;
    candidate++
  ) {
    const incomes = input.incomes.map((i) =>
      EMPLOYMENT.includes(i.kind)
        ? { ...i, endAge: Math.min(i.endAge ?? candidate, candidate) }
        : i,
    );
    if (
      summarise(projectYears({ ...input, retirementAge: candidate, incomes }))
        .feasible
    ) {
      return candidate;
    }
  }
  return null;
};

export const project = (input: PlanInput): PlanProjection => {
  const years = projectYears(input);
  return {
    years,
    verdict: {
      ...summarise(years),
      earliestSustainableRetirementAge: earliestSustainableRetirementAge(input),
    },
  };
};

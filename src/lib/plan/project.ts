// src/lib/plan/project.ts
import { contributionTargetId, fundDeficit } from "./assets";
import { amountThisYear, grow, round, sum } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import { incomeTax } from "./tax";
import type {
  AssetInput,
  ExpenseInput,
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

const projectYears = (
  input: PlanInput,
  returnDeltaPct = 0,
): YearProjection[] => {
  // A plan with no assets gets an implicit cash account so inflows/surplus are
  // never silently lost.
  const runAssets = input.assets.length > 0 ? input.assets : SYNTHETIC_CASH;

  const assetBal: Record<string, number> = {};
  for (const a of runAssets) assetBal[a.id] = a.openingValue;
  const liabBal: Record<string, number> = {};
  for (const l of input.liabilities) liabBal[l.id] = l.openingBalance;

  // Expenses linked to a liability are that liability's repayment: they fund
  // liabilityStep (REPAYMENT outflow) instead of the category totals, so the
  // money out is counted exactly once.
  const liabilityIds = new Set(input.liabilities.map((l) => l.id));
  const linkedExpenseByLiability = new Map<string, ExpenseInput>();
  for (const e of input.expenses) {
    if (e.liabilityId !== undefined && liabilityIds.has(e.liabilityId))
      linkedExpenseByLiability.set(e.liabilityId, e);
  }
  // An expense whose liabilityId matches no liability is treated as a normal
  // expense — never silently dropped from the totals.
  const unlinkedExpenses = input.expenses.filter(
    (e) => e.liabilityId === undefined || !liabilityIds.has(e.liabilityId),
  );

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
      unlinkedExpenses,
      age,
      yearsElapsed,
      input.inflationPct,
    );

    const annualPayments: Record<string, number> = {};
    for (const l of input.liabilities) {
      const linked = linkedExpenseByLiability.get(l.id);
      annualPayments[l.id] = linked
        ? linked.inflationLinked
          ? amountThisYear(
              linked.annualAmount,
              input.inflationPct,
              yearsElapsed,
            )
          : linked.annualAmount
        : l.monthlyRepayment * 12;
    }
    const liab = liabilityStep(input.liabilities, liabBal, age, annualPayments);
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
        age,
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
        (a.expectedReturnPct ?? input.defaultReturnPct) -
          (a.feePct ?? 0) +
          returnDeltaPct,
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
      value:
        l.startAge !== undefined && age < l.startAge
          ? 0
          : round(liabBal[l.id] ?? 0),
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
      summarise(
        projectYears({ ...input, retirementAge: candidate, incomes }),
        input.expectedDeathAge ?? input.planToAge,
      ).feasible
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
      ...summarise(years, input.expectedDeathAge ?? input.planToAge),
      earliestSustainableRetirementAge: earliestSustainableRetirementAge(input),
    },
  };
};

// Three deterministic passes for the return band. The spread shifts every
// asset's effective return by ±returnSpreadPct. mid === project(input). Only the
// mid pass computes earliestSustainableRetirementAge (the only pass that surfaces
// it); low/high set it null to avoid the extra projection sweep.
export const projectWithBand = (
  input: PlanInput,
  opts: { withEarliest?: boolean } = {},
): { low: PlanProjection; mid: PlanProjection; high: PlanProjection } => {
  const spread = input.returnSpreadPct ?? 0;
  const withEarliest = opts.withEarliest ?? true;
  const pass = (delta: number, computeEarliest: boolean): PlanProjection => {
    const years = projectYears(input, delta);
    return {
      years,
      verdict: {
        ...summarise(years, input.expectedDeathAge ?? input.planToAge),
        earliestSustainableRetirementAge: computeEarliest
          ? earliestSustainableRetirementAge(input)
          : null,
      },
    };
  };
  return {
    low: pass(-spread, false),
    mid: pass(0, withEarliest),
    high: pass(spread, false),
  };
};

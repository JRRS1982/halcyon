// src/lib/plan/project.ts
import { contributionTargetId, fundDeficit } from "./assets";
import { amountThisYear, grow, round, sum } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import { incomeTax } from "./tax";
import type { PlanInput, PlanProjection, YearProjection } from "./types";
import { summarise } from "./verdict";

const projectYears = (input: PlanInput): YearProjection[] => {
  const assetBal: Record<string, number> = {};
  for (const a of input.assets) assetBal[a.id] = a.openingValue;
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

    const contributedByAsset: Record<string, number> = {};
    let contributions = 0;
    for (const a of input.assets) {
      const endAge = a.contributionEndAge ?? input.retirementAge;
      if (!a.annualContribution || age >= endAge) continue;
      const c = amountThisYear(
        a.annualContribution,
        input.inflationPct,
        yearsElapsed,
      );
      assetBal[a.id] = (assetBal[a.id] ?? 0) + c;
      contributedByAsset[a.id] = c;
      contributions += c;
    }

    const eventsNet = sum(
      input.events
        .filter((e) => e.age === age)
        .map((e) => (e.direction === "INFLOW" ? e.amount : -e.amount)),
    );

    const cashflow =
      netIncome - expenses.total - liab.repaid - contributions + eventsNet;

    let withdrawalTax = 0;
    let withdrawals = 0;
    let shortfall = false;
    const withdrawnByAsset: Record<string, number> = {};

    if (cashflow >= 0) {
      const targetId = contributionTargetId(input.assets);
      if (targetId) assetBal[targetId] = (assetBal[targetId] ?? 0) + cashflow;
    } else {
      const fund = fundDeficit(
        input.assets,
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

    for (const a of input.assets) {
      assetBal[a.id] = grow(
        assetBal[a.id] ?? 0,
        a.expectedReturnPct ?? input.defaultReturnPct,
      );
    }

    const assets = input.assets.map((a) => ({
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

export const project = (input: PlanInput): PlanProjection => {
  const years = projectYears(input);
  return {
    years,
    verdict: { ...summarise(years), earliestSustainableRetirementAge: null },
  };
};

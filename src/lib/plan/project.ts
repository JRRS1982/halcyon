// src/lib/plan/project.ts
import { contributionTargetId, fundDeficit } from "./assets";
import { amountThisYear, grow, round, sum } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import { incomeTax } from "./tax";
import type {
  AssetInput,
  ExpenseInput,
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

  // Property sales: assetId -> { age, liabilityId? }. A sale zeroes the property
  // (and its linked mortgage) from its age on, and pays net proceeds into cash.
  const mortgageByAsset = new Map<string, string>();
  for (const l of input.liabilities)
    if (l.linkedAssetId !== undefined)
      mortgageByAsset.set(l.linkedAssetId, l.id);
  const saleAgeByAsset = new Map<string, number>();
  for (const e of input.events)
    if (e.kind === "PROPERTY_SALE" && e.assetId !== undefined)
      saleAgeByAsset.set(e.assetId, e.age);

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
        .filter((e) => e.age === age && e.kind !== "PROPERTY_SALE")
        .map((e) => (e.direction === "INFLOW" ? e.amount : -e.amount)),
    );

    // Property sales that land this year: liquidate to cash net of the mortgage.
    let saleNet = 0;
    for (const e of input.events) {
      if (
        e.kind !== "PROPERTY_SALE" ||
        e.age !== age ||
        e.assetId === undefined
      )
        continue;
      const propVal = assetBal[e.assetId] ?? 0;
      const liabId = mortgageByAsset.get(e.assetId);
      const mortBal = liabId ? (liabBal[liabId] ?? 0) : 0;
      saleNet += propVal - mortBal;
      assetBal[e.assetId] = 0;
      if (liabId) liabBal[liabId] = 0;
    }

    // Contributions are funded only from the year's operating cash flow; they
    // never force a (taxable) drawdown. If cash flow can't cover the full
    // requested amount, contributions scale down proportionally.
    const preContribCashflow =
      netIncome - expenses.total - liab.repaid + eventsNet + saleNet;
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
      const saleAge = saleAgeByAsset.get(a.id);
      if (saleAge !== undefined && age >= saleAge) {
        assetBal[a.id] = 0;
        continue;
      }
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
    const liabilities = input.liabilities.map((l) => {
      const notStarted = l.startAge !== undefined && age < l.startAge;
      const split = liab.byLiability[l.id] ?? { interest: 0, principal: 0 };
      return {
        id: l.id,
        label: l.label,
        value: notStarted ? 0 : round(liabBal[l.id] ?? 0),
        interest: round(split.interest),
        principal: round(split.principal),
      };
    });
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
    verdict: summarise(years, input.expectedDeathAge ?? input.planToAge),
  };
};

// Three deterministic passes for the return band. The spread shifts every
// asset's effective return by ±returnSpreadPct. mid === project(input).
export const projectWithBand = (
  input: PlanInput,
): { low: PlanProjection; mid: PlanProjection; high: PlanProjection } => {
  const spread = input.returnSpreadPct ?? 0;
  const pass = (delta: number): PlanProjection => {
    const years = projectYears(input, delta);
    return {
      years,
      verdict: summarise(years, input.expectedDeathAge ?? input.planToAge),
    };
  };
  return { low: pass(-spread), mid: pass(0), high: pass(spread) };
};

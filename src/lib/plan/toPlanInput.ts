// src/lib/plan/toPlanInput.ts

import type {
  Plan,
  PlanAsset,
  PlanEvent,
  PlanExpense,
  PlanIncome,
  PlanLiability,
} from "@prisma/client";
import { isExpenseSection } from "@/lib/categories/sections";
import type {
  BandedProjection,
  BandedVerdict,
  Growth,
  Milestone,
  PlanInput,
  PlanProjection,
  Verdict,
} from "@/lib/plan";

export type PlanWithChildren = Plan & {
  assets: PlanAsset[];
  liabilities: PlanLiability[];
  incomes: PlanIncome[];
  expenses: PlanExpense[];
  events: PlanEvent[];
};

const num = (d: { toString(): string }): number => Number(d.toString());
const optNum = (d: { toString(): string } | null): number | undefined =>
  d === null ? undefined : Number(d.toString());

export const growthOf = (
  kind: PlanIncome["growthKind"],
  pct: number | undefined,
): Growth => {
  if (kind === "FIXED") return { kind: "FIXED", pct: pct ?? 0 };
  if (kind === "NONE") return { kind: "NONE" };
  return { kind: "INFLATION" };
};

export function toPlanInput(
  plan: PlanWithChildren,
  asOfYear: number,
): PlanInput {
  const currentAge = asOfYear - plan.dateOfBirth.getUTCFullYear();
  const statePension =
    plan.statePensionAge !== null && plan.statePensionAnnual !== null
      ? {
          startAge: plan.statePensionAge,
          annualAmount: num(plan.statePensionAnnual),
        }
      : undefined;

  return {
    currentAge,
    startYear: asOfYear,
    retirementAge: plan.retirementAge,
    planToAge: plan.planToAge,
    expectedDeathAge: plan.expectedDeathAge ?? undefined,
    inflationPct: num(plan.inflationPct),
    defaultReturnPct: num(plan.defaultReturnPct),
    returnSpreadPct: num(plan.returnSpreadPct),
    taxRegime: plan.taxRegime,
    thresholdsInflationLinked: plan.thresholdsInflationLinked,
    statePension,
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      openingValue: num(a.openingValue),
      expectedReturnPct: optNum(a.expectedReturnPct),
      feePct: num(a.feePct),
      monthlyContribution: num(a.monthlyContribution),
      contributionEndAge: a.contributionEndAge ?? undefined,
      minAccessAge: a.minAccessAge ?? undefined,
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      openingBalance: num(l.openingBalance),
      interestPct: num(l.interestPct),
      monthlyRepayment: num(l.monthlyRepayment),
      startAge: l.startAge ?? undefined,
      endAge: l.endAge ?? undefined,
      linkedAssetId: l.linkedAssetId ?? undefined,
      interestOnly: l.interestOnly,
    })),
    incomes: plan.incomes.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      annualAmount: num(i.annualAmount),
      startAge: i.startAge ?? undefined,
      endAge: i.endAge ?? undefined,
      growth: growthOf(i.growthKind, optNum(i.growthPct)),
      taxable: i.taxable,
    })),
    expenses: plan.expenses.map((e) => ({
      id: e.id,
      label: e.label,
      // PlanExpense.section is nullable and typed as the full CategorySection
      // enum by Prisma; the check constraint guarantees a non-null value is
      // always an expense section, but the type doesn't know that.
      section:
        e.section !== null && isExpenseSection(e.section)
          ? e.section
          : undefined,
      annualAmount: num(e.annualAmount),
      startAge: e.startAge ?? undefined,
      endAge: e.endAge ?? undefined,
      inflationLinked: e.inflationLinked,
      liabilityId: e.liabilityId ?? undefined,
    })),
    events: plan.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      amount: num(ev.amount),
      kind: ev.kind,
      assetId: ev.assetId ?? undefined,
    })),
  };
}

// Deflates each pass to today's money, then assembles the BandedVerdict ranges
// from the *deflated* figures — deflation is age-dependent, so a range must be
// taken after it, never by deflating a pre-computed nominal range. The headline
// verdict is anchored on mid.
export function toTodaysMoneyBand(
  band: { low: PlanProjection; mid: PlanProjection; high: PlanProjection },
  inflationPct: number,
  currentAge: number,
): BandedProjection {
  const low = toTodaysMoney(band.low, inflationPct, currentAge);
  const mid = toTodaysMoney(band.mid, inflationPct, currentAge);
  const high = toTodaysMoney(band.high, inflationPct, currentAge);

  const range = (values: number[]): [number, number] | null =>
    values.length > 0 ? [Math.min(...values), Math.max(...values)] : null;

  const milestoneValues = (pick: (v: Verdict) => Milestone): number[] =>
    [low, mid, high]
      .map((p) => pick(p.verdict)?.value)
      .filter((v): v is number => v !== undefined);

  const shortfalls = [low, mid, high]
    .map((p) => p.verdict.firstShortfallAge)
    .filter((a): a is number => a !== null);

  const verdict: BandedVerdict = {
    ...mid.verdict,
    netWorthAtRetirementRange: range(
      milestoneValues((v) => v.netWorthAtRetirement),
    ),
    netWorthAtDeathRange: range(milestoneValues((v) => v.netWorthAtDeath)),
    firstShortfallAgeRange: range(shortfalls),
  };

  return { low: low.years, mid: mid.years, high: high.years, verdict };
}

// Engine output is nominal (future £). Deflate to today's money for display.
export function toTodaysMoney(
  projection: PlanProjection,
  inflationPct: number,
  currentAge: number,
): PlanProjection {
  const deflate = (value: number, age: number): number =>
    Math.round(value / (1 + inflationPct / 100) ** (age - currentAge));

  const years = projection.years.map((y) => ({
    ...y,
    grossIncome: deflate(y.grossIncome, y.age),
    tax: deflate(y.tax, y.age),
    netIncome: deflate(y.netIncome, y.age),
    totalExpenses: deflate(y.totalExpenses, y.age),
    liabilityRepayments: deflate(y.liabilityRepayments, y.age),
    surplus: deflate(y.surplus, y.age),
    contributions: deflate(y.contributions, y.age),
    withdrawals: deflate(y.withdrawals, y.age),
    liabilitiesTotal: deflate(y.liabilitiesTotal, y.age),
    netWorth: deflate(y.netWorth, y.age),
    incomeByKind: Object.fromEntries(
      Object.entries(y.incomeByKind).map(([k, v]) => [k, deflate(v, y.age)]),
    ),
    expensesByCategory: Object.fromEntries(
      Object.entries(y.expensesByCategory).map(([k, v]) => [
        k,
        deflate(v, y.age),
      ]),
    ),
    assets: y.assets.map((a) => ({
      ...a,
      value: deflate(a.value, y.age),
      contributed: deflate(a.contributed, y.age),
      withdrawn: deflate(a.withdrawn, y.age),
    })),
    liabilities: y.liabilities.map((l) => ({
      ...l,
      value: deflate(l.value, y.age),
      interest: deflate(l.interest, y.age),
      principal: deflate(l.principal, y.age),
    })),
  }));

  // Each milestone is pinned to an age, so deflating its own value at that age
  // lands on exactly the figure the deflated series carries for that year.
  const toRealTerms = (milestone: Milestone): Milestone =>
    milestone && {
      age: milestone.age,
      value: deflate(milestone.value, milestone.age),
    };

  return {
    verdict: {
      ...projection.verdict,
      netWorthAtRetirement: toRealTerms(
        projection.verdict.netWorthAtRetirement,
      ),
      netWorthAtDeath: toRealTerms(projection.verdict.netWorthAtDeath),
    },
    years,
  };
}

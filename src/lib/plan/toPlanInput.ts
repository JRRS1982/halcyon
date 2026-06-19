// src/lib/plan/toPlanInput.ts
import type { Growth, PlanInput, PlanProjection } from "@/lib/plan";
import type {
  Plan,
  PlanAsset,
  PlanEvent,
  PlanExpense,
  PlanIncome,
  PlanLiability,
} from "@prisma/client";

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

const growthOf = (
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
    inflationPct: num(plan.inflationPct),
    defaultReturnPct: num(plan.defaultReturnPct),
    taxRatePct: num(plan.blendedTaxRatePct),
    statePension,
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      openingValue: num(a.openingValue),
      expectedReturnPct: optNum(a.expectedReturnPct),
      annualContribution: num(a.annualContribution),
      contributionEndAge: a.contributionEndAge ?? undefined,
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      openingBalance: num(l.openingBalance),
      interestPct: num(l.interestPct),
      monthlyRepayment: num(l.monthlyRepayment),
      endAge: l.endAge ?? undefined,
      linkedAssetId: l.linkedAssetId ?? undefined,
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
      category: e.category ?? undefined,
      annualAmount: num(e.annualAmount),
      startAge: e.startAge ?? undefined,
      endAge: e.endAge ?? undefined,
      inflationLinked: e.inflationLinked,
    })),
    events: plan.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      amount: num(ev.amount),
    })),
  };
}

// Engine output is nominal (future £). Deflate to today's money for display.
export function toTodaysMoney(
  projection: PlanProjection,
  inflationPct: number,
  currentAge: number,
): PlanProjection {
  const deflate = (value: number, age: number): number =>
    Math.round(value / (1 + inflationPct / 100) ** (age - currentAge));

  return {
    verdict: {
      ...projection.verdict,
      peakNetWorth: {
        age: projection.verdict.peakNetWorth.age,
        value: deflate(
          projection.verdict.peakNetWorth.value,
          projection.verdict.peakNetWorth.age,
        ),
      },
    },
    years: projection.years.map((y) => ({
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
      })),
    })),
  };
}

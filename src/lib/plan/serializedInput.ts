// src/lib/plan/serializedInput.ts
// Client-side counterpart of toPlanInput: maps the serialized (plain-number)
// plan the client holds into the engine's PlanInput, so the pure engine can
// re-run in the browser for the real-time sliders. Parity with toPlanInput is
// covered by serializedInput.test.ts.
// interestOnly and linkedAssetId ARE wired through here: interestOnly changes
// engine maths (interest-only balances stay flat), and linkedAssetId is read
// by project.ts to net + clear a mortgage against its property on a
// PROPERTY_SALE — the client live projection must see both to match the
// server. Nothing remains intentionally omitted.
import type { SerializedPlan } from "@/app/(app)/plan/serialized";
import type { PlanInput } from "@/lib/plan";
import { growthOf } from "./toPlanInput";

export function serializedToPlanInput(
  plan: SerializedPlan,
  asOfYear: number,
): PlanInput {
  const a = plan.assumptions;
  const birthYear = Number(a.dateOfBirth.slice(0, 4));
  const statePension =
    a.statePensionAge !== null && a.statePensionAnnual !== null
      ? { startAge: a.statePensionAge, annualAmount: a.statePensionAnnual }
      : undefined;

  return {
    currentAge: asOfYear - birthYear,
    startYear: asOfYear,
    retirementAge: a.retirementAge,
    planToAge: a.planToAge,
    expectedDeathAge: a.expectedDeathAge ?? undefined,
    inflationPct: a.inflationPct,
    defaultReturnPct: a.defaultReturnPct,
    returnSpreadPct: a.returnSpreadPct,
    taxRegime: a.taxRegime,
    thresholdsInflationLinked: a.thresholdsInflationLinked,
    statePension,
    assets: plan.assets.map((x) => ({
      id: x.id,
      label: x.label,
      wrapper: x.wrapper,
      openingValue: x.openingValue,
      expectedReturnPct: x.expectedReturnPct ?? undefined,
      feePct: x.feePct,
      annualContribution: x.annualContribution,
      contributionEndAge: x.contributionEndAge ?? undefined,
      minAccessAge: x.minAccessAge ?? undefined,
      drawdownPriority: x.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((x) => ({
      id: x.id,
      label: x.label,
      openingBalance: x.openingBalance,
      interestPct: x.interestPct,
      monthlyRepayment: x.monthlyRepayment,
      startAge: x.startAge ?? undefined,
      endAge: x.endAge ?? undefined,
      linkedAssetId: x.linkedAssetId ?? undefined,
      interestOnly: x.interestOnly,
    })),
    incomes: plan.incomes.map((x) => ({
      id: x.id,
      label: x.label,
      kind: x.kind,
      annualAmount: x.annualAmount,
      startAge: x.startAge ?? undefined,
      endAge: x.endAge ?? undefined,
      growth: growthOf(x.growthKind, x.growthPct ?? undefined),
      taxable: x.taxable,
    })),
    expenses: plan.expenses.map((x) => ({
      id: x.id,
      label: x.label,
      category: x.category ?? undefined,
      annualAmount: x.annualAmount,
      startAge: x.startAge ?? undefined,
      endAge: x.endAge ?? undefined,
      inflationLinked: x.inflationLinked,
      liabilityId: x.liabilityId ?? undefined,
    })),
    events: plan.events.map((x) => ({
      id: x.id,
      label: x.label,
      age: x.age,
      direction: x.direction,
      amount: x.amount,
      kind: x.kind,
      assetId: x.assetId ?? undefined,
    })),
  };
}

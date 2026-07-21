// src/app/plan/page.tsx
import { projectWithBand } from "@/lib/plan";
import { toPlanInput, toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreatePlanForm } from "./CreatePlanForm";
import { PlanView } from "./PlanView";
import { getPrimaryPlan } from "./actions";
import type { SerializedPlan } from "./serialized";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/plan");

  const { currency, numberFormat } = await getCurrentUserSettings();
  const plan = await getPrimaryPlan();

  if (!plan) {
    return <CreatePlanForm />;
  }

  const asOfYear = new Date().getUTCFullYear();
  const input = toPlanInput(plan, asOfYear);
  const band = toTodaysMoneyBand(
    projectWithBand(input),
    input.inflationPct,
    input.currentAge,
  );

  const serialized: SerializedPlan = {
    assumptions: {
      id: plan.id,
      dateOfBirth: plan.dateOfBirth.toISOString().slice(0, 10),
      retirementAge: plan.retirementAge,
      planToAge: plan.planToAge,
      inflationPct: Number(plan.inflationPct),
      defaultReturnPct: Number(plan.defaultReturnPct),
      returnSpreadPct: Number(plan.returnSpreadPct),
      blendedTaxRatePct: Number(plan.blendedTaxRatePct),
      statePensionAge: plan.statePensionAge,
      statePensionAnnual:
        plan.statePensionAnnual === null
          ? null
          : Number(plan.statePensionAnnual),
      expectedDeathAge: plan.expectedDeathAge,
    },
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      openingValue: Number(a.openingValue),
      expectedReturnPct:
        a.expectedReturnPct === null ? null : Number(a.expectedReturnPct),
      feePct: Number(a.feePct),
      annualContribution: Number(a.annualContribution),
      contributionEndAge: a.contributionEndAge,
      minAccessAge: a.minAccessAge,
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      openingBalance: Number(l.openingBalance),
      interestPct: Number(l.interestPct),
      monthlyRepayment: Number(l.monthlyRepayment),
      startAge: l.startAge,
      endAge: l.endAge,
      linkedAssetId: l.linkedAssetId,
    })),
    incomes: plan.incomes.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      annualAmount: Number(i.annualAmount),
      startAge: i.startAge,
      endAge: i.endAge,
      growthKind: i.growthKind,
      growthPct: i.growthPct === null ? null : Number(i.growthPct),
      taxable: i.taxable,
    })),
    expenses: plan.expenses.map((e) => ({
      id: e.id,
      label: e.label,
      category: e.category ?? "FIXED",
      annualAmount: Number(e.annualAmount),
      startAge: e.startAge,
      endAge: e.endAge,
      inflationLinked: e.inflationLinked,
      liabilityId: e.liabilityId,
    })),
    events: plan.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      amount: Number(ev.amount),
    })),
  };

  return (
    <PlanView
      band={band}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
      asOfYear={asOfYear}
    />
  );
}

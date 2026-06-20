// src/app/plan/page.tsx
import { project } from "@/lib/plan";
import { toPlanInput, toTodaysMoney } from "@/lib/plan/toPlanInput";
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
  const plan = await getPrimaryPlan(user.id);

  if (!plan) {
    return <CreatePlanForm />;
  }

  const asOfYear = new Date().getUTCFullYear();
  const input = toPlanInput(plan, asOfYear);
  const projection = toTodaysMoney(
    project(input),
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
      blendedTaxRatePct: Number(plan.blendedTaxRatePct),
      statePensionAge: plan.statePensionAge,
      statePensionAnnual:
        plan.statePensionAnnual === null
          ? null
          : Number(plan.statePensionAnnual),
    },
    assets: plan.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      openingValue: Number(a.openingValue),
      expectedReturnPct:
        a.expectedReturnPct === null ? null : Number(a.expectedReturnPct),
      annualContribution: Number(a.annualContribution),
      drawdownPriority: a.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      openingBalance: Number(l.openingBalance),
      interestPct: Number(l.interestPct),
      monthlyRepayment: Number(l.monthlyRepayment),
      endAge: l.endAge,
    })),
  };

  return (
    <PlanView
      years={projection.years}
      verdict={projection.verdict}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
}

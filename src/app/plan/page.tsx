// src/app/plan/page.tsx
import { project } from "@/lib/plan";
import { toPlanInput, toTodaysMoney } from "@/lib/plan/toPlanInput";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreatePlanForm } from "./CreatePlanForm";
import { PlanView } from "./PlanView";
import { getPrimaryPlan } from "./actions";

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

  return (
    <PlanView
      years={projection.years}
      verdict={projection.verdict}
      currency={currency}
      numberFormat={numberFormat}
    />
  );
}

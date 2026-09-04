// src/app/plan/page.tsx

import { redirect } from "next/navigation";
import { isExpenseSection } from "@/lib/categories/sections";
import { projectWithBand } from "@/lib/plan";
import { toPlanInput, toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { getPrimaryPlan } from "./actions";
import { CreatePlanForm } from "./CreatePlanForm";
import { PlanView } from "./PlanView";
import type { SerializedPlan } from "./serialized";
import { getPlanSyncPreview } from "./syncActions";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/plan");

  // Both need the user and neither needs the other, so they overlap rather
  // than queueing: getPrimaryPlan re-checks the session itself (a round trip
  // to Supabase Auth) before its own query, which used to wait behind the
  // settings read for no reason. getCurrentUser above stays sequential — it is
  // the gate both of these are behind, and it is memoised per request.
  const [{ currency, numberFormat }, plan] = await Promise.all([
    getCurrentUserSettings(),
    getPrimaryPlan(),
  ]);

  if (!plan) {
    return <CreatePlanForm />;
  }

  // Not hoisted into the Promise.all above: it returns null when there is no
  // primary plan, so starting it early would cost a user who has none an
  // extra plan look-up to produce a value this branch never reads.
  const syncPreview = await getPlanSyncPreview();

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
      taxRegime: plan.taxRegime,
      thresholdsInflationLinked: plan.thresholdsInflationLinked,
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
      monthlyContribution: Number(a.monthlyContribution),
      contributionEndAge: a.contributionEndAge,
      minAccessAge: a.minAccessAge,
      drawdownPriority: a.drawdownPriority,
      annualIncome: a.annualIncome === null ? null : Number(a.annualIncome),
      incomeFromAge: a.incomeFromAge,
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
      interestOnly: l.interestOnly,
      revisionAge: l.revisionAge,
      revisionRate: l.revisionRate === null ? null : Number(l.revisionRate),
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
      // PlanExpense.section is nullable and typed as the full CategorySection
      // enum by Prisma; the check constraint guarantees a non-null value is
      // always an expense section, but the type doesn't know that.
      section:
        e.section !== null && isExpenseSection(e.section) ? e.section : null,
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
      kind: ev.kind,
      assetId: ev.assetId,
    })),
  };

  return (
    <PlanView
      band={band}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
      asOfYear={asOfYear}
      syncPreview={syncPreview}
    />
  );
}

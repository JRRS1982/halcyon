// src/app/plan/usePlanProjection.ts
"use client";

import type { BandedProjection } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePlanAssumptions } from "./actions";
import { type AssumptionOverrides, computeLiveBand } from "./liveBand";
import type { SerializedPlan, SerializedPlanAssumptions } from "./serialized";

type SliderKey = keyof AssumptionOverrides;

export function usePlanProjection(
  plan: SerializedPlan,
  serverBand: BandedProjection,
  asOfYear: number,
) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<AssumptionOverrides>({});
  const [liveBand, setLiveBand] = useState<BandedProjection>(serverBand);
  const frame = useRef<number | null>(null);

  // Fresh server props (after a commit + refresh, or any external change) reset
  // the live state — overrides clear and the live band falls back to the server
  // band. Depending on serverBand identity means the override persists through
  // the commit→refresh window (no flash-back to the pre-drag value).
  useEffect(() => {
    setOverrides({});
    setLiveBand(serverBand);
  }, [serverBand]);

  const setOverride = useCallback(
    (key: SliderKey, value: number) => {
      setOverrides((prev) => {
        const next = { ...prev, [key]: value };
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          setLiveBand(computeLiveBand(plan, next, serverBand, asOfYear));
        });
        return next;
      });
    },
    [plan, serverBand, asOfYear],
  );

  const commit = useCallback(
    async (key: SliderKey, value: number) => {
      const a = plan.assumptions;
      await updatePlanAssumptions({
        planId: a.id,
        dateOfBirth: a.dateOfBirth,
        retirementAge: a.retirementAge,
        planToAge: a.planToAge,
        inflationPct: a.inflationPct,
        defaultReturnPct: a.defaultReturnPct,
        returnSpreadPct: a.returnSpreadPct,
        blendedTaxRatePct: a.blendedTaxRatePct,
        statePensionAge: a.statePensionAge,
        statePensionAnnual: a.statePensionAnnual,
        [key]: value,
      });
      router.refresh();
    },
    [plan, router],
  );

  const effectiveAssumptions: SerializedPlanAssumptions = {
    ...plan.assumptions,
    ...overrides,
  };

  return { liveBand, effectiveAssumptions, setOverride, commit };
}

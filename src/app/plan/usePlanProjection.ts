// src/app/plan/usePlanProjection.ts
"use client";

import type { BandedProjection } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePlanAssumptions, updatePlanEvent } from "./actions";
import {
  type AssumptionOverrides,
  type LiveOverrides,
  computeLiveBand,
} from "./liveBand";
import type {
  SerializedPlan,
  SerializedPlanAssumptions,
  SerializedPlanEvent,
} from "./serialized";

type SliderKey = keyof AssumptionOverrides;
const EMPTY: LiveOverrides = { assumptions: {}, events: {} };

export function usePlanProjection(
  plan: SerializedPlan,
  serverBand: BandedProjection,
  asOfYear: number,
) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<LiveOverrides>(EMPTY);
  const [liveBand, setLiveBand] = useState<BandedProjection>(serverBand);
  const frame = useRef<number | null>(null);

  // Fresh server props reset the live state; the override persists through the
  // commit→refresh window (keyed on serverBand identity → no flash-back).
  useEffect(() => {
    setOverrides(EMPTY);
    setLiveBand(serverBand);
  }, [serverBand]);

  const scheduleRecompute = useCallback(
    (next: LiveOverrides) => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setLiveBand(computeLiveBand(plan, next, serverBand, asOfYear));
      });
    },
    [plan, serverBand, asOfYear],
  );

  const setOverride = useCallback(
    (key: SliderKey, value: number) => {
      setOverrides((prev) => {
        const next: LiveOverrides = {
          ...prev,
          assumptions: { ...prev.assumptions, [key]: value },
        };
        scheduleRecompute(next);
        return next;
      });
    },
    [scheduleRecompute],
  );

  const setEventOverride = useCallback(
    (id: string, age: number) => {
      setOverrides((prev) => {
        const next: LiveOverrides = {
          ...prev,
          events: { ...prev.events, [id]: age },
        };
        scheduleRecompute(next);
        return next;
      });
    },
    [scheduleRecompute],
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

  const commitEvent = useCallback(
    async (id: string, age: number) => {
      const ev = plan.events.find((e) => e.id === id);
      if (!ev) return;
      await updatePlanEvent({
        eventId: ev.id,
        label: ev.label,
        age,
        direction: ev.direction,
        amount: ev.amount,
      });
      router.refresh();
    },
    [plan, router],
  );

  const effectiveAssumptions: SerializedPlanAssumptions = {
    ...plan.assumptions,
    ...overrides.assumptions,
  };
  const liveEvents: SerializedPlanEvent[] = plan.events.map((e) =>
    e.id in overrides.events
      ? { ...e, age: overrides.events[e.id] ?? e.age }
      : e,
  );

  return {
    liveBand,
    effectiveAssumptions,
    liveEvents,
    setOverride,
    commit,
    setEventOverride,
    commitEvent,
  };
}

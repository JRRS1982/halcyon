// src/app/plan/usePlanProjection.ts
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BandedProjection } from "@/lib/plan";
import {
  updatePlanAssumptions,
  updatePlanEvent,
  updatePlanExpense,
  updatePlanIncome,
  updatePlanLiability,
} from "./actions";
import {
  type AssumptionOverrides,
  computeLiveBand,
  type LiveOverrides,
  type StreamOverride,
  withStreamAges,
} from "./liveBand";
import type {
  SerializedPlan,
  SerializedPlanAssumptions,
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "./serialized";

type SliderKey = keyof AssumptionOverrides;
type StreamLane = "income" | "expense" | "liability";
const EMPTY: LiveOverrides = { assumptions: {}, events: {}, streams: {} };

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

  const setStreamOverride = useCallback(
    (id: string, ages: StreamOverride) => {
      setOverrides((prev) => {
        const next: LiveOverrides = {
          ...prev,
          // Merge onto any existing override for this id so setting the end
          // handle doesn't wipe a start-handle override made in the same drag.
          streams: { ...prev.streams, [id]: { ...prev.streams[id], ...ages } },
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
        taxRegime: a.taxRegime,
        thresholdsInflationLinked: a.thresholdsInflationLinked,
        statePensionAge: a.statePensionAge,
        statePensionAnnual: a.statePensionAnnual,
        expectedDeathAge: a.expectedDeathAge,
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
        kind: ev.kind,
        assetId: ev.assetId,
      });
      router.refresh();
    },
    [plan, router],
  );

  const commitStream = useCallback(
    async (lane: StreamLane, id: string, ages: StreamOverride) => {
      if (lane === "income") {
        const i = plan.incomes.find((x) => x.id === id);
        if (!i) return;
        const next = withStreamAges(i, ages);
        await updatePlanIncome({
          incomeId: i.id,
          label: i.label,
          kind: i.kind,
          annualAmount: i.annualAmount,
          startAge: next.startAge,
          endAge: next.endAge,
          growthKind: i.growthKind,
          growthPct: i.growthPct,
          taxable: i.taxable,
        });
      } else if (lane === "expense") {
        const e = plan.expenses.find((x) => x.id === id);
        if (!e) return;
        const next = withStreamAges(e, ages);
        await updatePlanExpense({
          expenseId: e.id,
          label: e.label,
          // Dragging a bar-edge only reaches a plain expense — a
          // repayment-linked one drags its liability instead (see
          // timelineData.ts's dragLane) — so a real expense here always
          // carries a section; the fallback only guards the type.
          section: e.section ?? "FIXED",
          annualAmount: e.annualAmount,
          startAge: next.startAge,
          endAge: next.endAge,
          inflationLinked: e.inflationLinked,
        });
      } else {
        const l = plan.liabilities.find((x) => x.id === id);
        if (!l) return;
        const next = withStreamAges(l, ages);
        await updatePlanLiability({
          liabilityId: l.id,
          label: l.label,
          openingBalance: l.openingBalance,
          interestPct: l.interestPct,
          monthlyRepayment: l.monthlyRepayment,
          startAge: next.startAge,
          endAge: next.endAge,
          linkedAssetId: l.linkedAssetId,
          interestOnly: l.interestOnly,
          revisionAge: l.revisionAge,
          revisionRate: l.revisionRate,
        });
      }
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
  const liveIncomes: SerializedPlanIncome[] = plan.incomes.map((i) =>
    withStreamAges(i, overrides.streams[i.id]),
  );
  const liveExpenses: SerializedPlanExpense[] = plan.expenses.map((e) =>
    withStreamAges(e, overrides.streams[e.id]),
  );
  const liveLiabilities: SerializedPlanLiability[] = plan.liabilities.map((l) =>
    withStreamAges(l, overrides.streams[l.id]),
  );

  return {
    liveBand,
    effectiveAssumptions,
    liveEvents,
    liveIncomes,
    liveExpenses,
    liveLiabilities,
    setOverride,
    commit,
    setEventOverride,
    commitEvent,
    setStreamOverride,
    commitStream,
  };
}

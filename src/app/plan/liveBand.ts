// src/app/plan/liveBand.ts
// Pure client-side recompute for the real-time sliders — a drag frame costs only
// the three cheap band passes.
import { type BandedProjection, projectWithBand } from "@/lib/plan";
import { serializedToPlanInput } from "@/lib/plan/serializedInput";
import { toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import type { SerializedPlan, SerializedPlanAssumptions } from "./serialized";

export type AssumptionOverrides = Partial<
  Pick<
    SerializedPlanAssumptions,
    "retirementAge" | "defaultReturnPct" | "returnSpreadPct" | "inflationPct"
  >
>;

// A dragged bar edge overrides one or both age bounds of an income/expense/
// liability. undefined = leave as committed.
export type StreamOverride = {
  startAge?: number | null;
  endAge?: number | null;
};

export type LiveOverrides = {
  assumptions: AssumptionOverrides;
  events: Record<string, number>; // event id → overridden age
  streams: Record<string, StreamOverride>; // income/expense/liability id → age bounds
};

export function withStreamAges<
  T extends { startAge: number | null; endAge: number | null },
>(item: T, o: StreamOverride | undefined): T {
  if (!o) return item;
  return {
    ...item,
    startAge: o.startAge !== undefined ? o.startAge : item.startAge,
    endAge: o.endAge !== undefined ? o.endAge : item.endAge,
  };
}

export function computeLiveBand(
  plan: SerializedPlan,
  overrides: LiveOverrides,
  serverBand: BandedProjection,
  asOfYear: number,
): BandedProjection {
  const noAssumptions = Object.keys(overrides.assumptions).length === 0;
  const noEvents = Object.keys(overrides.events).length === 0;
  const noStreams = Object.keys(overrides.streams).length === 0;
  if (noAssumptions && noEvents && noStreams) return serverBand;

  const input = serializedToPlanInput(
    {
      ...plan,
      assumptions: { ...plan.assumptions, ...overrides.assumptions },
      events: plan.events.map((e) =>
        e.id in overrides.events
          ? { ...e, age: overrides.events[e.id] ?? e.age }
          : e,
      ),
      incomes: plan.incomes.map((i) =>
        withStreamAges(i, overrides.streams[i.id]),
      ),
      expenses: plan.expenses.map((e) =>
        withStreamAges(e, overrides.streams[e.id]),
      ),
      liabilities: plan.liabilities.map((l) =>
        withStreamAges(l, overrides.streams[l.id]),
      ),
    },
    asOfYear,
  );
  return toTodaysMoneyBand(
    projectWithBand(input),
    input.inflationPct,
    input.currentAge,
  );
}

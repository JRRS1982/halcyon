// src/app/plan/liveBand.ts
// Pure client-side recompute for the real-time sliders. Skips the O(years^2)
// earliest-retirement sweep (withEarliest:false) and carries the server band's
// earliest value, so a drag frame costs only the three cheap band passes.
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

export type LiveOverrides = {
  assumptions: AssumptionOverrides;
  events: Record<string, number>; // event id → overridden age
};

export function computeLiveBand(
  plan: SerializedPlan,
  overrides: LiveOverrides,
  serverBand: BandedProjection,
  asOfYear: number,
): BandedProjection {
  const noAssumptions = Object.keys(overrides.assumptions).length === 0;
  const noEvents = Object.keys(overrides.events).length === 0;
  if (noAssumptions && noEvents) return serverBand;

  const input = serializedToPlanInput(
    {
      ...plan,
      assumptions: { ...plan.assumptions, ...overrides.assumptions },
      events: plan.events.map((e) =>
        e.id in overrides.events
          ? { ...e, age: overrides.events[e.id] ?? e.age }
          : e,
      ),
    },
    asOfYear,
  );
  const band = toTodaysMoneyBand(
    projectWithBand(input, { withEarliest: false }),
    input.inflationPct,
    input.currentAge,
  );
  return {
    ...band,
    verdict: {
      ...band.verdict,
      earliestSustainableRetirementAge:
        serverBand.verdict.earliestSustainableRetirementAge,
    },
  };
}

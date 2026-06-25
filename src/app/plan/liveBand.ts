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

export function computeLiveBand(
  plan: SerializedPlan,
  overrides: AssumptionOverrides,
  serverBand: BandedProjection,
  asOfYear: number,
): BandedProjection {
  if (Object.keys(overrides).length === 0) return serverBand;

  const input = serializedToPlanInput(
    { ...plan, assumptions: { ...plan.assumptions, ...overrides } },
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

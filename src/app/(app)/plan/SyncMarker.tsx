// src/app/plan/SyncMarker.tsx
//
// Renders one of the four states syncIndicator.ts decides between. The glyph
// alone (✓ ● ◇) is not enough for a screen-reader user to tell "changed" from
// "plan-only" apart, so each one carries an accessible name via role="img" —
// the same pattern AT tools use to expose a meaningful icon.
"use client";

import styled from "styled-components";
import type { SyncPlan } from "@/lib/plan/sync";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { indicatorFor, type SyncIndicator } from "./syncIndicator";

// "attached" shares the ◇ glyph deliberately: to a sighted user both mean the
// same thing — Sync will remove this row — and inventing a fourth symbol for a
// distinction the shape cannot carry would only add noise. The accessible name
// is where they differ, because the *reason* differs and one of them would be
// a false statement about the other's row.
const GLYPH: Record<SyncIndicator, string> = {
  synced: "✓",
  changed: "●",
  "plan-only": "◇",
  attached: "◇",
};

const LABEL: Record<SyncIndicator, string> = {
  synced: "Synced — matches your balance sheet",
  changed: "Changed — differs from your balance sheet, Sync will replace it",
  "plan-only": "Plan only — not on your balance sheet, Sync will remove it",
  attached: "Attached — Sync will remove it with the row it cannot outlive",
};

const Glyph = styled.span<{ $indicator: SyncIndicator }>`
  font-size: 12px;
  line-height: 1;
  color: ${({ theme, $indicator }) =>
    $indicator === "changed"
      ? theme.colors.accent
      : $indicator === "synced"
        ? theme.colors.positive
        : theme.colors.dim};
`;
const SourceFigure = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;

// A flow difference is a different claim from a value one, and it comes from a
// different sheet: monthlyContribution and monthlyRepayment are fed by the
// budget's TRANSFER and REPAYMENT rows, so naming the balance sheet beside a
// flow figure would be a false statement about where it came from.
const FLOW_CHANGED_LABEL =
  "Changed — the amount budgeted into it differs from your budget sheet, Sync will replace it";

export function SyncMarker({
  indicator,
  sourceFigure,
  sourceLabel,
}: {
  indicator: SyncIndicator;
  /** The reality figure to show beside a "changed" marker, e.g. "£81,002". */
  sourceFigure?: string;
  /** Overrides the accessible name when the figure is not the row's value. */
  sourceLabel?: string;
}) {
  return (
    <>
      <Glyph
        role="img"
        aria-label={sourceLabel ?? LABEL[indicator]}
        $indicator={indicator}
      >
        {GLYPH[indicator]}
      </Glyph>
      {indicator === "changed" && sourceFigure ? (
        <SourceFigure>{sourceFigure}</SourceFigure>
      ) : null}
    </>
  );
}

// The props a table row needs to render its marker: the state, plus — only
// when changed — the reality figure to show beside the plan's own.
//
// Which figure is not a given. An update carries four fields, and showing the
// value unconditionally printed the row's own number back at it whenever the
// value was not what moved: `● £250,000` beside £250,000. That is worse than
// no figure, because this marker is the documented warning for the one case
// where a Sync silently zeroes something — a hand-typed monthlyRepayment with
// no REPAYMENT budget row behind it. So the figure shown is the one that
// actually changed, and when neither number changed (a rename, a re-wrapped
// account) there is no figure to show.
export function rowMarkerProps(
  rowId: string,
  plan: SyncPlan,
  currency: string,
  numberFormat: NumberFormat,
  /** The row's own figures, to compare the update against. */
  row: { value: number; flow: number | null },
): { indicator: SyncIndicator; sourceFigure?: string; sourceLabel?: string } {
  const indicator = indicatorFor(rowId, plan);
  if (indicator !== "changed") return { indicator };

  const truth = plan.updates.find((u) => u.id === rowId);
  if (truth === undefined) return { indicator };

  if (truth.value !== row.value) {
    return {
      indicator,
      sourceFigure: formatAmount(currency, truth.value, numberFormat),
    };
  }
  if (truth.flow !== null && truth.flow !== row.flow) {
    return {
      indicator,
      sourceFigure: formatAmount(currency, truth.flow, numberFormat),
      sourceLabel: FLOW_CHANGED_LABEL,
    };
  }
  return { indicator };
}

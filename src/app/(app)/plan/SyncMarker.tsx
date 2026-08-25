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

export function SyncMarker({
  indicator,
  sourceFigure,
}: {
  indicator: SyncIndicator;
  /** The reality figure to show beside a "changed" marker, e.g. "£81,002". */
  sourceFigure?: string;
}) {
  return (
    <>
      <Glyph role="img" aria-label={LABEL[indicator]} $indicator={indicator}>
        {GLYPH[indicator]}
      </Glyph>
      {indicator === "changed" && sourceFigure ? (
        <SourceFigure>{sourceFigure}</SourceFigure>
      ) : null}
    </>
  );
}

// The props a table row needs to render its marker: the state, plus — only
// when changed — the reality figure to show beside the plan's own value.
export function rowMarkerProps(
  rowId: string,
  plan: SyncPlan,
  currency: string,
  numberFormat: NumberFormat,
): { indicator: SyncIndicator; sourceFigure?: string } {
  const indicator = indicatorFor(rowId, plan);
  if (indicator !== "changed") return { indicator };

  const truth = plan.updates.find((u) => u.id === rowId);
  return {
    indicator,
    sourceFigure:
      truth === undefined
        ? undefined
        : formatAmount(currency, truth.value, numberFormat),
  };
}

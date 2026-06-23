// src/app/plan/Timeline.tsx
"use client";

import { type TimelineBar, toTimelineModel } from "@/lib/plan/timelineData";
import styled, { useTheme } from "styled-components";
import { DEBT_COLOUR, INCOME_COLOURS, OUTFLOW_COLOURS } from "./colours";
import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "./serialized";

// The exhaustive cashflow palettes are keyed by their literal unions; widen to
// a string index so a bar's `subKind` (typed `string | null`) can look up its
// colour, with a theme fallback. Safe: income/expense subKinds are always
// members of these maps (see colours.ts).
const INCOME = INCOME_COLOURS as Record<string, string>;
const OUTFLOW = OUTFLOW_COLOURS as Record<string, string>;

// Width of the left label gutter — single source so the bar tracks and the
// reference-line overlay share one coordinate space and stay aligned.
const GUTTER = "140px";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Plot = styled.div`
  position: relative;
  min-width: 480px;
`;
const Rows = styled.div`
  display: grid;
  grid-template-columns: ${GUTTER} 1fr;
  align-items: center;
  row-gap: ${({ theme }) => theme.spacing.xs};
`;
const GroupLabel = styled.div`
  grid-column: 1 / -1;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.dim};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
const RowLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: ${({ theme }) => theme.spacing.sm};
`;
const Track = styled.div`
  position: relative;
  height: 18px;
`;
const Bar = styled.div`
  position: absolute;
  top: 2px;
  height: 14px;
  border-radius: 3px;
  min-width: 2px;
`;
const Marker = styled.div<{ $inflow: boolean }>`
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  background: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
`;
const Overlay = styled.div`
  position: absolute;
  left: ${GUTTER};
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
`;
const RefLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed ${({ theme }) => theme.colors.hairlineStrong};
`;
const RefLabel = styled.span`
  position: absolute;
  top: 0;
  left: 4px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;
const Tick = styled.span`
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 11px;
  color: ${({ theme }) => theme.colors.body};
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: 0;
`;

export function Timeline({
  incomes,
  expenses,
  liabilities,
  events,
  retirementAge,
  statePensionAge,
  minAge,
  maxAge,
}: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  retirementAge: number;
  statePensionAge: number | null;
  minAge: number;
  maxAge: number;
}) {
  const theme = useTheme();
  const model = toTimelineModel({
    incomes,
    expenses,
    liabilities,
    events,
    minAge,
    maxAge,
    retirementAge,
    statePensionAge,
  });

  const barColour = (b: TimelineBar): string => {
    if (b.lane === "liability") return DEBT_COLOUR;
    const map = b.lane === "income" ? INCOME : OUTFLOW;
    return map[b.subKind ?? ""] ?? theme.colors.dim;
  };

  const groups: [string, TimelineBar[]][] = [
    ["Income", model.bars.income],
    ["Expenses", model.bars.expense],
    ["Liabilities", model.bars.liability],
  ];
  const hasContent =
    groups.some(([, bars]) => bars.length > 0) || model.events.length > 0;

  return (
    <Panel>
      <Heading>Timeline</Heading>
      {hasContent ? (
        <Plot>
          <Rows>
            {groups.map(([label, bars]) =>
              bars.length === 0 ? null : (
                <div key={label} style={{ display: "contents" }}>
                  <GroupLabel>{label}</GroupLabel>
                  {bars.map((b) => (
                    <div key={b.id} style={{ display: "contents" }}>
                      <RowLabel title={b.label}>{b.label}</RowLabel>
                      <Track>
                        <Bar
                          style={{
                            left: `${b.leftPct}%`,
                            width: `${b.widthPct}%`,
                            background: barColour(b),
                          }}
                          title={`${b.label}: ${b.startAge}–${b.endAge}`}
                        />
                      </Track>
                    </div>
                  ))}
                </div>
              ),
            )}
            {model.events.length > 0 ? (
              <div style={{ display: "contents" }}>
                <GroupLabel>Events</GroupLabel>
                <RowLabel />
                <Track>
                  {model.events.map((m) => (
                    <Marker
                      key={m.id}
                      $inflow={m.direction === "INFLOW"}
                      style={{ left: `${m.leftPct}%` }}
                      title={`${m.label} (age ${m.age})`}
                    />
                  ))}
                </Track>
              </div>
            ) : null}
            <RowLabel />
            <Track>
              {model.ticks.map((t) => (
                <Tick key={t.age} style={{ left: `${t.leftPct}%` }}>
                  {t.age}
                </Tick>
              ))}
            </Track>
          </Rows>
          <Overlay>
            {model.refLines.map((r) => (
              <RefLine
                key={r.label}
                style={{ left: `${r.leftPct}%` }}
                title={`${r.label} (age ${r.age})`}
              >
                <RefLabel>{r.label}</RefLabel>
              </RefLine>
            ))}
          </Overlay>
        </Plot>
      ) : (
        <Empty>Add income, expenses or events to see your timeline.</Empty>
      )}
    </Panel>
  );
}

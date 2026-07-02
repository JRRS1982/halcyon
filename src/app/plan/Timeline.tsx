// src/app/plan/Timeline.tsx
"use client";

import {
  type TimelineBar,
  ageFromOffset,
  clampHandle,
  toTimelineModel,
} from "@/lib/plan/timelineData";
import { useRef } from "react";
import styled, { useTheme } from "styled-components";
import { PlanCard } from "./PlanCard";
import { PLOT_LEFT_INSET, PLOT_RIGHT_INSET } from "./axisGeometry";
import { DEBT_COLOUR, INCOME_COLOURS, OUTFLOW_COLOURS } from "./colours";
import type { StreamOverride } from "./liveBand";
import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "./serialized";

type StreamLane = "income" | "expense" | "liability";

// The exhaustive cashflow palettes are keyed by their literal unions; widen to
// a string index so a bar's `subKind` (typed `string | null`) can look up its
// colour, with a theme fallback. Safe: income/expense subKinds are always
// members of these maps (see colours.ts).
const INCOME = INCOME_COLOURS as Record<string, string>;
const OUTFLOW = OUTFLOW_COLOURS as Record<string, string>;

// Width of the left label gutter — single source so the bar tracks and the
// reference-line overlay share one coordinate space and stay aligned.
const GUTTER = `${PLOT_LEFT_INSET}px`;

const Panel = styled(PlanCard)`
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
  padding-right: ${PLOT_RIGHT_INSET}px;
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
const Handle = styled.div`
  position: absolute;
  top: 0;
  width: 10px;
  height: 18px;
  transform: translateX(-50%);
  cursor: ew-resize;
  touch-action: none;
  border-radius: 3px;
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.ink};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;
const Marker = styled.div<{ $inflow: boolean }>`
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  cursor: ew-resize;
  touch-action: none;
  background: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;
const Overlay = styled.div`
  position: absolute;
  left: ${GUTTER};
  right: ${PLOT_RIGHT_INSET}px;
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
const GuideLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.hairline};
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

// One draggable grip on a bar edge. Reads its own Track's rect at drag time
// (all bar tracks share the plot's coordinate space), converts pointer x → age,
// and clamps so start never crosses end. Live-updates on drag, persists on
// release — the same pattern as the event markers.
function BarHandle({
  bar,
  edge,
  minAge,
  maxAge,
  onInput,
  onCommit,
}: {
  bar: TimelineBar;
  edge: "start" | "end";
  minAge: number;
  maxAge: number;
  onInput?: (id: string, ages: StreamOverride) => void;
  onCommit?: (lane: StreamLane, id: string, ages: StreamOverride) => void;
}) {
  const pct = edge === "start" ? bar.leftPct : bar.leftPct + bar.widthPct;
  const ageNow = edge === "start" ? bar.startAge : bar.endAge;
  const bound = (age: number): StreamOverride =>
    edge === "start" ? { startAge: age } : { endAge: age };
  const ageAt = (track: HTMLElement | null, clientX: number): number => {
    const r = track?.getBoundingClientRect();
    if (!r) return ageNow;
    return clampHandle(
      edge,
      ageFromOffset(clientX, r.left, r.width, minAge, maxAge),
      bar.startAge,
      bar.endAge,
      minAge,
      maxAge,
    );
  };

  return (
    <Handle
      style={{ left: `${pct}%` }}
      role="slider"
      tabIndex={0}
      aria-label={`${bar.label} ${edge} age`}
      aria-valuemin={minAge}
      aria-valuemax={maxAge}
      aria-valuenow={ageNow}
      title={`${bar.label} ${edge} (age ${ageNow})`}
      onPointerDown={(e) => {
        if (!onInput) return;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!onInput || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onInput(bar.id, bound(ageAt(e.currentTarget.parentElement, e.clientX)));
      }}
      onPointerUp={(e) => {
        if (!onCommit || !e.currentTarget.hasPointerCapture(e.pointerId))
          return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onCommit(
          bar.lane,
          bar.id,
          bound(ageAt(e.currentTarget.parentElement, e.clientX)),
        );
      }}
      onKeyDown={(e) => {
        if (!onInput) return;
        const delta =
          e.key === "ArrowRight" || e.key === "ArrowUp"
            ? 1
            : e.key === "ArrowLeft" || e.key === "ArrowDown"
              ? -1
              : 0;
        if (delta === 0) return;
        e.preventDefault();
        const next = clampHandle(
          edge,
          ageNow + delta,
          bar.startAge,
          bar.endAge,
          minAge,
          maxAge,
        );
        onInput(bar.id, bound(next));
      }}
      onKeyUp={(e) => {
        if (!onCommit) return;
        if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(e.key))
          onCommit(bar.lane, bar.id, bound(ageNow));
      }}
    />
  );
}

export function Timeline({
  incomes,
  expenses,
  liabilities,
  events,
  retirementAge,
  statePensionAge,
  minAge,
  maxAge,
  onEventInput,
  onEventCommit,
  onStreamInput,
  onStreamCommit,
}: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  retirementAge: number;
  statePensionAge: number | null;
  minAge: number;
  maxAge: number;
  onEventInput?: (id: string, age: number) => void;
  onEventCommit?: (id: string, age: number) => void;
  onStreamInput?: (id: string, ages: StreamOverride) => void;
  onStreamCommit?: (lane: StreamLane, id: string, ages: StreamOverride) => void;
}) {
  const theme = useTheme();
  const eventTrackRef = useRef<HTMLDivElement>(null);
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
                        {b.lane !== "liability" ? (
                          <BarHandle
                            bar={b}
                            edge="start"
                            minAge={minAge}
                            maxAge={maxAge}
                            onInput={onStreamInput}
                            onCommit={onStreamCommit}
                          />
                        ) : null}
                        <BarHandle
                          bar={b}
                          edge="end"
                          minAge={minAge}
                          maxAge={maxAge}
                          onInput={onStreamInput}
                          onCommit={onStreamCommit}
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
                <Track ref={eventTrackRef}>
                  {model.events.map((m) => {
                    const ageAt = (clientX: number): number => {
                      const r = eventTrackRef.current?.getBoundingClientRect();
                      if (!r) return m.age;
                      return ageFromOffset(
                        clientX,
                        r.left,
                        r.width,
                        minAge,
                        maxAge,
                      );
                    };
                    return (
                      <Marker
                        key={m.id}
                        $inflow={m.direction === "INFLOW"}
                        style={{ left: `${m.leftPct}%` }}
                        role="slider"
                        tabIndex={0}
                        aria-label={`${m.label} age`}
                        aria-valuemin={minAge}
                        aria-valuemax={maxAge}
                        aria-valuenow={m.age}
                        title={`${m.label} (age ${m.age})`}
                        onPointerDown={(e) => {
                          if (!onEventInput) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (
                            !onEventInput ||
                            !e.currentTarget.hasPointerCapture(e.pointerId)
                          )
                            return;
                          onEventInput(m.id, ageAt(e.clientX));
                        }}
                        onPointerUp={(e) => {
                          if (
                            !onEventCommit ||
                            !e.currentTarget.hasPointerCapture(e.pointerId)
                          )
                            return;
                          e.currentTarget.releasePointerCapture(e.pointerId);
                          onEventCommit(m.id, ageAt(e.clientX));
                        }}
                        onKeyDown={(e) => {
                          if (!onEventInput) return;
                          const delta =
                            e.key === "ArrowRight" || e.key === "ArrowUp"
                              ? 1
                              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                                ? -1
                                : 0;
                          if (delta === 0) return;
                          e.preventDefault();
                          const next = Math.min(
                            Math.max(m.age + delta, minAge),
                            maxAge,
                          );
                          onEventInput(m.id, next);
                        }}
                        onKeyUp={(e) => {
                          if (!onEventCommit) return;
                          if (
                            [
                              "ArrowRight",
                              "ArrowUp",
                              "ArrowLeft",
                              "ArrowDown",
                            ].includes(e.key)
                          )
                            onEventCommit(m.id, m.age);
                        }}
                      />
                    );
                  })}
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
            {model.ticks.map((t) => (
              <GuideLine
                key={`guide-${t.age}`}
                style={{ left: `${t.leftPct}%` }}
              />
            ))}
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

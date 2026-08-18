// src/app/plan/Timeline.tsx
"use client";

import {
  type TimelineBar,
  type TimelineMarker,
  ageFromOffset,
  clampHandle,
  toTimelineModel,
} from "@/lib/plan/timelineData";
import styled, { useTheme } from "styled-components";
import { PlanCard } from "./PlanCard";
import {
  PHONE_PLOT_QUERY,
  PLOT_LEFT_INSET,
  PLOT_LEFT_INSET_PHONE,
  PLOT_RIGHT_INSET,
} from "./axisGeometry";
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
// reference-line overlay share one coordinate space and stay aligned. Narrows
// on a phone (with the charts' Y axis) so the plot keeps most of the card;
// row labels ellipsize into the smaller column.
const GUTTER = `${PLOT_LEFT_INSET}px`;
const GUTTER_PHONE = `${PLOT_LEFT_INSET_PHONE}px`;

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

  @media ${PHONE_PLOT_QUERY} {
    grid-template-columns: ${GUTTER_PHONE} 1fr;
  }
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
// A one-off event renders as a full-height vertical line across every lane
// (like the retirement / state-pension ref lines) rather than a diamond in its
// own row. EventHit is a slim transparent strip that carries the drag/keyboard
// interaction; EventStroke is the visible coloured line centred within it.
const EventHit = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  cursor: ew-resize;
  touch-action: none;
  pointer-events: auto;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;
const EventStroke = styled.div<{ $inflow: boolean }>`
  width: 2px;
  height: 100%;
  background: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
`;
const EventLabel = styled.span<{ $inflow: boolean; $level: number }>`
  position: absolute;
  top: ${({ $level }) => $level * 13}px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 2px;
  font-size: 10px;
  white-space: nowrap;
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
`;
const Overlay = styled.div`
  position: absolute;
  left: ${GUTTER};
  right: ${PLOT_RIGHT_INSET}px;
  top: 0;
  bottom: 0;
  pointer-events: none;

  @media ${PHONE_PLOT_QUERY} {
    left: ${GUTTER_PHONE};
  }
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
// $flip: a mark near the plot's right edge writes its label to the LEFT of
// the line — "Life expectancy" hangs off the card otherwise.
const RefLabel = styled.span<{ $level: number; $flip: boolean }>`
  position: absolute;
  top: ${({ $level }) => $level * 13}px;
  ${({ $flip }) => ($flip ? "right: 4px;" : "left: 4px;")}
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
      // Position-aware centring: translateX slides from 0% at the left edge to
      // -100% at the right edge (still -50% mid-track), so an edge grip at 0% or
      // 100% stays fully on-track and grabbable instead of hanging half off it.
      style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}
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
        onInput(
          bar.dragId,
          bound(ageAt(e.currentTarget.parentElement, e.clientX)),
        );
      }}
      onPointerUp={(e) => {
        if (!onCommit || !e.currentTarget.hasPointerCapture(e.pointerId))
          return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onCommit(
          bar.dragLane,
          bar.dragId,
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
        onInput(bar.dragId, bound(next));
      }}
      onKeyUp={(e) => {
        if (!onCommit) return;
        if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(e.key))
          onCommit(bar.dragLane, bar.dragId, bound(ageNow));
      }}
    />
  );
}

// A draggable vertical event line. Reads the shared plot rect (its Overlay
// parent, same coordinate space as the bar tracks) at drag time and converts
// pointer x → age. Live-updates on drag/arrow-key, persists on release/keyup —
// the same interaction the event diamonds had before, now spanning all lanes.
function EventLine({
  marker,
  minAge,
  maxAge,
  onInput,
  onCommit,
}: {
  marker: TimelineMarker;
  minAge: number;
  maxAge: number;
  onInput?: (id: string, age: number) => void;
  onCommit?: (id: string, age: number) => void;
}) {
  const inflow = marker.direction === "INFLOW";
  const ageAt = (overlay: HTMLElement | null, clientX: number): number => {
    const r = overlay?.getBoundingClientRect();
    if (!r) return marker.age;
    return ageFromOffset(clientX, r.left, r.width, minAge, maxAge);
  };

  return (
    <EventHit
      style={{ left: `${marker.leftPct}%` }}
      role="slider"
      tabIndex={0}
      aria-label={`${marker.label} age`}
      aria-valuemin={minAge}
      aria-valuemax={maxAge}
      aria-valuenow={marker.age}
      title={`${marker.label} (age ${marker.age})`}
      onPointerDown={(e) => {
        if (!onInput) return;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!onInput || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onInput(marker.id, ageAt(e.currentTarget.parentElement, e.clientX));
      }}
      onPointerUp={(e) => {
        if (!onCommit || !e.currentTarget.hasPointerCapture(e.pointerId))
          return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onCommit(marker.id, ageAt(e.currentTarget.parentElement, e.clientX));
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
        const next = Math.min(Math.max(marker.age + delta, minAge), maxAge);
        onInput(marker.id, next);
      }}
      onKeyUp={(e) => {
        if (!onCommit) return;
        if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(e.key))
          onCommit(marker.id, marker.age);
      }}
    >
      <EventStroke $inflow={inflow} />
      <EventLabel $inflow={inflow} $level={marker.labelLevel}>
        {marker.label}
      </EventLabel>
    </EventHit>
  );
}

export function Timeline({
  incomes,
  expenses,
  liabilities,
  events,
  retirementAge,
  statePensionAge,
  expectedDeathAge,
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
  expectedDeathAge: number | null;
  minAge: number;
  maxAge: number;
  onEventInput?: (id: string, age: number) => void;
  onEventCommit?: (id: string, age: number) => void;
  onStreamInput?: (id: string, ages: StreamOverride) => void;
  onStreamCommit?: (lane: StreamLane, id: string, ages: StreamOverride) => void;
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
    expectedDeathAge,
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
                        <BarHandle
                          bar={b}
                          edge="start"
                          minAge={minAge}
                          maxAge={maxAge}
                          onInput={onStreamInput}
                          onCommit={onStreamCommit}
                        />
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
                <RefLabel $level={r.labelLevel} $flip={r.leftPct > 70}>
                  {r.label}
                </RefLabel>
              </RefLine>
            ))}
            {model.events.map((m) => (
              <EventLine
                key={m.id}
                marker={m}
                minAge={minAge}
                maxAge={maxAge}
                onInput={onEventInput}
                onCommit={onEventCommit}
              />
            ))}
          </Overlay>
        </Plot>
      ) : (
        <Empty>Add income, expenses or events to see your timeline.</Empty>
      )}
    </Panel>
  );
}

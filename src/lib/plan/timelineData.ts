import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "@/app/(app)/plan/serialized";

// Pure layout model for the read-only life timeline. All age→position maths
// live here so the Timeline component can stay a dumb renderer. No React, no
// colours (colour is the component's concern).

export type TimelineRange = { minAge: number; maxAge: number };

export type TimelineBar = {
  id: string;
  label: string;
  lane: "income" | "expense" | "liability";
  subKind: string | null; // income kind / expense category; null for liability
  startAge: number; // resolved + clamped to range
  endAge: number; // resolved + clamped to range
  leftPct: number; // 0..100
  widthPct: number; // 0..100, never negative
  // Which record a drag on this bar edits. A linked repayment expense renders
  // in the expense lane but drags its liability (the liability owns timing).
  dragLane: "income" | "expense" | "liability";
  dragId: string;
};

export type TimelineMarker = {
  id: string;
  label: string;
  age: number; // real age (may be outside range; title shows it)
  direction: "INFLOW" | "OUTFLOW";
  leftPct: number; // 0..100 (clamped position)
  labelLevel: number; // vertical stagger row (0 = top) so close labels don't overlap
};

export type TimelineTick = { age: number; leftPct: number };
export type TimelineRefLine = {
  label: string;
  age: number;
  leftPct: number;
  labelLevel: number; // vertical stagger row (0 = top), as with event labels
};

export type TimelineModel = {
  range: TimelineRange;
  bars: {
    income: TimelineBar[];
    expense: TimelineBar[];
    liability: TimelineBar[];
  };
  events: TimelineMarker[];
  refLines: TimelineRefLine[];
  ticks: TimelineTick[];
};

export function toTimelineModel(input: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  minAge: number;
  maxAge: number;
  retirementAge: number;
  statePensionAge: number | null;
  expectedDeathAge: number | null;
}): TimelineModel {
  const { minAge, maxAge } = input;
  const span = maxAge - minAge;

  const clamp = (age: number) => Math.min(Math.max(age, minAge), maxAge);
  const pct = (age: number) =>
    span <= 0 ? 0 : ((clamp(age) - minAge) / span) * 100;

  const makeBar = (
    id: string,
    label: string,
    lane: TimelineBar["lane"],
    subKind: string | null,
    rawStart: number,
    rawEnd: number,
    drag?: { lane: TimelineBar["lane"]; id: string },
  ): TimelineBar => ({
    id,
    label,
    lane,
    subKind,
    startAge: clamp(rawStart),
    endAge: clamp(rawEnd),
    leftPct: pct(rawStart),
    widthPct: Math.max(0, pct(rawEnd) - pct(rawStart)),
    dragLane: drag?.lane ?? lane,
    dragId: drag?.id ?? id,
  });

  const income = input.incomes.map((i) =>
    makeBar(
      i.id,
      i.label,
      "income",
      i.kind,
      i.startAge ?? minAge,
      i.endAge ?? maxAge,
    ),
  );
  const liabilityById = new Map(input.liabilities.map((l) => [l.id, l]));
  const expense = input.expenses.map((e) => {
    const linked =
      e.liabilityId !== null ? liabilityById.get(e.liabilityId) : undefined;
    if (!linked) {
      return makeBar(
        e.id,
        e.label,
        "expense",
        e.section,
        e.startAge ?? minAge,
        e.endAge ?? maxAge,
      );
    }
    return makeBar(
      e.id,
      e.label,
      "expense",
      e.section,
      linked.startAge ?? minAge,
      linked.endAge ?? maxAge,
      { lane: "liability", id: linked.id },
    );
  });
  const liability = input.liabilities.map((l) =>
    makeBar(
      l.id,
      l.label,
      "liability",
      null,
      l.startAge ?? minAge,
      l.endAge ?? maxAge,
    ),
  );

  const events = staggerLabels(
    input.events.map((ev) => ({
      id: ev.id,
      label: ev.label,
      age: ev.age,
      direction: ev.direction,
      leftPct: pct(ev.age),
      labelLevel: 0,
    })),
  );

  const refMarks: { label: string; age: number; leftPct: number }[] = [];
  const addRef = (label: string, age: number | null) => {
    if (age !== null && age >= minAge && age <= maxAge)
      refMarks.push({ label, age, leftPct: pct(age) });
  };
  addRef("Retirement", input.retirementAge);
  addRef("State pension", input.statePensionAge);
  addRef("Life expectancy", input.expectedDeathAge);
  const refLevels = levelsByLeftPct(
    refMarks.map((r) => ({ key: r.label, leftPct: r.leftPct })),
  );
  const refLines: TimelineRefLine[] = refMarks.map((r) => ({
    ...r,
    labelLevel: refLevels.get(r.label) ?? 0,
  }));

  // The start age always gets a tick; the 5-year marks then skip any that land
  // within two years of it — a 44 next to a 45 renders as one smudge at every
  // realistic plot width.
  const ticks: TimelineTick[] = [{ age: minAge, leftPct: 0 }];
  if (span > 0) {
    for (let age = Math.ceil(minAge / 5) * 5; age <= maxAge; age += 5) {
      if (age - minAge >= 3) ticks.push({ age, leftPct: pct(age) });
    }
  }

  return {
    range: { minAge, maxAge },
    bars: { income, expense, liability },
    events,
    refLines,
    ticks,
  };
}

// Approximate horizontal footprint of an event label, as a share of the track
// width. Text width isn't measurable in this pure layout, so this is a
// heuristic: events whose lines fall within this many percent of each other get
// their labels stacked instead of overlapping.
const LABEL_GAP_PCT = 8;

// Greedy vertical packing shared by event and reference-line labels: a
// left-to-right sweep drops each label to the lowest row whose previous label
// sits at least LABEL_GAP_PCT to its left, so labels with room all stay on row
// 0 and only crowded ones stack. Returns a level (0 = top) keyed by each item.
function levelsByLeftPct(
  items: { key: string; leftPct: number }[],
): Map<string, number> {
  const lastLeftByLevel: number[] = [];
  const levelByKey = new Map<string, number>();
  for (const it of [...items].sort((a, b) => a.leftPct - b.leftPct)) {
    let level = 0;
    let lastLeft = lastLeftByLevel[level];
    while (lastLeft !== undefined && it.leftPct - lastLeft < LABEL_GAP_PCT) {
      level++;
      lastLeft = lastLeftByLevel[level];
    }
    lastLeftByLevel[level] = it.leftPct;
    levelByKey.set(it.key, level);
  }
  return levelByKey;
}

// Assign each event label a vertical stagger row so labels of events close
// together in age don't overlap. Input order is preserved in the output.
export function staggerLabels(markers: TimelineMarker[]): TimelineMarker[] {
  const levels = levelsByLeftPct(
    markers.map((m) => ({ key: m.id, leftPct: m.leftPct })),
  );
  return markers.map((m) => ({ ...m, labelLevel: levels.get(m.id) ?? 0 }));
}

// Clamp a dragged bar-edge handle to a legal age. A start handle may not fall
// below minAge nor cross past the bar's end; an end handle may not exceed maxAge
// nor cross below the bar's start. Keeps a bar from inverting mid-drag.
export function clampHandle(
  edge: "start" | "end",
  age: number,
  startAge: number,
  endAge: number,
  minAge: number,
  maxAge: number,
): number {
  if (edge === "start") return Math.min(Math.max(age, minAge), endAge);
  return Math.min(Math.max(age, startAge), maxAge);
}

// Inverse of the layout pct(): given a pointer x and the track's left/width
// (from getBoundingClientRect), return the whole-year age under the cursor,
// clamped to the range. Degenerate width → minAge.
export function ageFromOffset(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  minAge: number,
  maxAge: number,
): number {
  if (trackWidth <= 0) return minAge;
  const fraction = (clientX - trackLeft) / trackWidth;
  const age = Math.round(minAge + fraction * (maxAge - minAge));
  return Math.min(Math.max(age, minAge), maxAge);
}

import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "@/app/plan/serialized";

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
};

export type TimelineMarker = {
  id: string;
  label: string;
  age: number; // real age (may be outside range; title shows it)
  direction: "INFLOW" | "OUTFLOW";
  leftPct: number; // 0..100 (clamped position)
};

export type TimelineTick = { age: number; leftPct: number };
export type TimelineRefLine = { label: string; age: number; leftPct: number };

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
  ): TimelineBar => ({
    id,
    label,
    lane,
    subKind,
    startAge: clamp(rawStart),
    endAge: clamp(rawEnd),
    leftPct: pct(rawStart),
    widthPct: Math.max(0, pct(rawEnd) - pct(rawStart)),
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
  const expense = input.expenses.map((e) =>
    makeBar(
      e.id,
      e.label,
      "expense",
      e.category,
      e.startAge ?? minAge,
      e.endAge ?? maxAge,
    ),
  );
  const liability = input.liabilities.map((l) =>
    makeBar(l.id, l.label, "liability", null, minAge, l.endAge ?? maxAge),
  );

  const events = input.events.map((ev) => ({
    id: ev.id,
    label: ev.label,
    age: ev.age,
    direction: ev.direction,
    leftPct: pct(ev.age),
  }));

  const refLines: TimelineRefLine[] = [];
  const addRef = (label: string, age: number | null) => {
    if (age !== null && age >= minAge && age <= maxAge)
      refLines.push({ label, age, leftPct: pct(age) });
  };
  addRef("Retirement", input.retirementAge);
  addRef("State pension", input.statePensionAge);

  const ticks: TimelineTick[] = [{ age: minAge, leftPct: 0 }];
  if (span > 0) {
    for (let age = Math.ceil(minAge / 10) * 10; age <= maxAge; age += 10) {
      if (age !== minAge) ticks.push({ age, leftPct: pct(age) });
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

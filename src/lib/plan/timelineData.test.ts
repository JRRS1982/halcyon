import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "@/app/plan/serialized";
import { ageFromOffset, clampHandle, toTimelineModel } from "./timelineData";

const income = (over: Partial<SerializedPlanIncome>): SerializedPlanIncome => ({
  id: "i1",
  label: "Salary",
  kind: "SALARY",
  annualAmount: 1000,
  startAge: null,
  endAge: null,
  growthKind: "INFLATION",
  growthPct: null,
  taxable: true,
  ...over,
});
const expense = (
  over: Partial<SerializedPlanExpense>,
): SerializedPlanExpense => ({
  id: "e1",
  label: "Living",
  category: "FIXED",
  annualAmount: 1000,
  startAge: null,
  endAge: null,
  inflationLinked: true,
  liabilityId: null,
  ...over,
});
const liability = (
  over: Partial<SerializedPlanLiability>,
): SerializedPlanLiability => ({
  id: "l1",
  label: "Mortgage",
  openingBalance: 1000,
  interestPct: 3,
  monthlyRepayment: 100,
  startAge: null,
  endAge: null,
  linkedAssetId: null,
  ...over,
});
const event = (over: Partial<SerializedPlanEvent>): SerializedPlanEvent => ({
  id: "v1",
  label: "House",
  age: 50,
  direction: "OUTFLOW",
  amount: 1000,
  ...over,
});

const base = {
  incomes: [],
  expenses: [],
  liabilities: [],
  events: [],
  minAge: 40,
  maxAge: 90,
  retirementAge: 65,
  statePensionAge: null as number | null,
  expectedDeathAge: null as number | null,
};

describe("toTimelineModel", () => {
  it("resolves null income start/end to the range edges (full-width bar)", () => {
    const m = toTimelineModel({ ...base, incomes: [income({})] });
    const bar = m.bars.income[0];
    expect(bar?.startAge).toBe(40);
    expect(bar?.endAge).toBe(90);
    expect(bar?.leftPct).toBe(0);
    expect(bar?.widthPct).toBe(100);
    expect(bar?.subKind).toBe("SALARY");
  });

  it("positions a bounded expense by age fraction", () => {
    const m = toTimelineModel({
      ...base,
      expenses: [expense({ startAge: 50, endAge: 60 })],
    });
    const bar = m.bars.expense[0];
    expect(bar?.leftPct).toBeCloseTo(20); // (50-40)/50
    expect(bar?.widthPct).toBeCloseTo(20); // (60-50)/50
  });

  it("spans a liability from minAge to its end age", () => {
    const m = toTimelineModel({
      ...base,
      liabilities: [liability({ endAge: 65 })],
    });
    const bar = m.bars.liability[0];
    expect(bar?.startAge).toBe(40);
    expect(bar?.endAge).toBe(65);
    expect(bar?.leftPct).toBe(0);
    expect(bar?.widthPct).toBeCloseTo(50); // (65-40)/50
    expect(bar?.subKind).toBeNull();
  });

  it("clamps out-of-range and inverted spans to widthPct 0", () => {
    const out = toTimelineModel({
      ...base,
      incomes: [income({ startAge: 100, endAge: 120 })],
    });
    expect(out.bars.income[0]?.widthPct).toBe(0);
    expect(out.bars.income[0]?.leftPct).toBe(100);

    const inverted = toTimelineModel({
      ...base,
      incomes: [income({ startAge: 80, endAge: 60 })],
    });
    expect(inverted.bars.income[0]?.widthPct).toBe(0);
  });

  it("keeps an out-of-range event at the edge (not dropped), with its real age", () => {
    const m = toTimelineModel({ ...base, events: [event({ age: 95 })] });
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.age).toBe(95);
    expect(m.events[0]?.leftPct).toBe(100);
  });

  it("includes retirement in range, excludes state pension when null", () => {
    const m = toTimelineModel({ ...base, retirementAge: 65 });
    expect(m.refLines.map((r) => r.label)).toEqual(["Retirement"]);
    expect(m.refLines[0]?.leftPct).toBeCloseTo(50); // (65-40)/50
  });

  it("staggers retirement and state-pension labels when they are close", () => {
    const m = toTimelineModel({
      ...base,
      retirementAge: 65,
      statePensionAge: 67,
    });
    const byLabel = new Map(m.refLines.map((r) => [r.label, r.labelLevel]));
    expect(byLabel.get("Retirement")).toBe(0);
    expect(byLabel.get("State pension")).toBe(1);
  });

  it("keeps retirement and state-pension labels on level 0 when far apart", () => {
    const m = toTimelineModel({
      ...base,
      retirementAge: 50,
      statePensionAge: 80,
    });
    expect(m.refLines.every((r) => r.labelLevel === 0)).toBe(true);
  });

  it("includes state pension when set and in range; excludes a retirement past maxAge", () => {
    const m = toTimelineModel({
      ...base,
      retirementAge: 99,
      statePensionAge: 67,
    });
    expect(m.refLines.map((r) => r.label)).toEqual(["State pension"]);
  });

  it("includes an in-range expected death age as a Life expectancy ref line", () => {
    const m = toTimelineModel({ ...base, expectedDeathAge: 88 });
    const life = m.refLines.find((r) => r.label === "Life expectancy");
    expect(life?.age).toBe(88);
  });

  it("omits the Life expectancy ref line when the death age is out of range", () => {
    const m = toTimelineModel({ ...base, expectedDeathAge: 130 });
    expect(m.refLines.map((r) => r.label)).not.toContain("Life expectancy");
  });

  it("emits 5-year ticks including minAge", () => {
    const m = toTimelineModel({ ...base, minAge: 40, maxAge: 90 });
    expect(m.ticks.map((t) => t.age)).toEqual([
      40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
    ]);
  });

  it("guards a degenerate single-year range (no divide-by-zero)", () => {
    const m = toTimelineModel({
      ...base,
      minAge: 50,
      maxAge: 50,
      incomes: [income({})],
    });
    expect(m.bars.income[0]?.leftPct).toBe(0);
    expect(m.bars.income[0]?.widthPct).toBe(0);
    expect(m.ticks).toEqual([{ age: 50, leftPct: 0 }]);
  });
});

describe("event label staggering", () => {
  const evAt = (id: string, age: number) => event({ id, age, label: id });

  it("keeps well-spaced event labels on level 0", () => {
    const m = toTimelineModel({
      ...base,
      events: [evAt("a", 45), evAt("b", 75)],
    });
    expect(m.events.map((e) => e.labelLevel)).toEqual([0, 0]);
  });

  it("staggers labels of events close in age onto increasing levels", () => {
    const m = toTimelineModel({
      ...base,
      events: [evAt("a", 50), evAt("b", 51), evAt("c", 52)],
    });
    const byId = new Map(m.events.map((e) => [e.id, e.labelLevel]));
    expect(byId.get("a")).toBe(0);
    expect(byId.get("b")).toBe(1);
    expect(byId.get("c")).toBe(2);
  });

  it("returns a label to level 0 once there is horizontal room again", () => {
    const m = toTimelineModel({
      ...base,
      events: [evAt("a", 50), evAt("b", 51), evAt("c", 70)],
    });
    const byId = new Map(m.events.map((e) => [e.id, e.labelLevel]));
    expect(byId.get("c")).toBe(0);
  });

  it("preserves input order in the returned events", () => {
    const m = toTimelineModel({
      ...base,
      events: [evAt("c", 70), evAt("a", 50), evAt("b", 51)],
    });
    expect(m.events.map((e) => e.id)).toEqual(["c", "a", "b"]);
  });
});

describe("liability startAge + linked expense drag targets", () => {
  it("starts a liability bar at its startAge", () => {
    const m = toTimelineModel({
      ...base,
      minAge: 40,
      maxAge: 90,
      liabilities: [liability({ startAge: 50, endAge: 70 })],
    });
    expect(m.bars.liability[0]?.startAge).toBe(50);
    expect(m.bars.liability[0]?.leftPct).toBeCloseTo(20); // (50-40)/50
  });

  it("bars drag themselves by default", () => {
    const m = toTimelineModel({
      ...base,
      incomes: [income({ startAge: 45, endAge: 65 })],
    });
    expect(m.bars.income[0]?.dragLane).toBe("income");
    expect(m.bars.income[0]?.dragId).toBe(m.bars.income[0]?.id);
  });

  it("a linked expense bar takes the liability window and drags the liability", () => {
    const m = toTimelineModel({
      ...base,
      minAge: 40,
      maxAge: 90,
      liabilities: [liability({ id: "m1", startAge: 50, endAge: 70 })],
      expenses: [
        expense({ id: "rep1", startAge: 41, endAge: 42, liabilityId: "m1" }),
      ],
    });
    const bar = m.bars.expense[0];
    expect(bar?.startAge).toBe(50); // liability's window, not the expense's own
    expect(bar?.endAge).toBe(70);
    expect(bar?.dragLane).toBe("liability");
    expect(bar?.dragId).toBe("m1");
  });
});

describe("ageFromOffset", () => {
  // track spans 44..95 over 0..1000px from x=100
  it("maps the track left edge to minAge and right edge to maxAge", () => {
    expect(ageFromOffset(100, 100, 1000, 44, 95)).toBe(44);
    expect(ageFromOffset(1100, 100, 1000, 44, 95)).toBe(95);
  });
  it("maps the midpoint to the rounded middle age", () => {
    // halfway = 44 + 0.5*51 = 69.5 → round → 70
    expect(ageFromOffset(600, 100, 1000, 44, 95)).toBe(70);
  });
  it("clamps below minAge and above maxAge", () => {
    expect(ageFromOffset(0, 100, 1000, 44, 95)).toBe(44);
    expect(ageFromOffset(5000, 100, 1000, 44, 95)).toBe(95);
  });
  it("returns minAge for a degenerate track width", () => {
    expect(ageFromOffset(300, 100, 0, 44, 95)).toBe(44);
  });
});

describe("clampHandle", () => {
  // A bar spans startAge=50..endAge=70 within a range of minAge=40..maxAge=90.
  it("keeps a start handle within [minAge, endAge]", () => {
    expect(clampHandle("start", 45, 50, 70, 40, 90)).toBe(45);
  });
  it("stops a start handle at minAge", () => {
    expect(clampHandle("start", 35, 50, 70, 40, 90)).toBe(40);
  });
  it("stops a start handle at the end age (never crosses it)", () => {
    expect(clampHandle("start", 80, 50, 70, 40, 90)).toBe(70);
  });
  it("keeps an end handle within [startAge, maxAge]", () => {
    expect(clampHandle("end", 65, 50, 70, 40, 90)).toBe(65);
  });
  it("stops an end handle at maxAge", () => {
    expect(clampHandle("end", 95, 50, 70, 40, 90)).toBe(90);
  });
  it("stops an end handle at the start age (never crosses it)", () => {
    expect(clampHandle("end", 45, 50, 70, 40, 90)).toBe(50);
  });
});

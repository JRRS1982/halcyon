import {
  type PlanRow,
  type RealityRow,
  resolvePlanSync,
  syncChangeCount,
} from "@/lib/plan/sync";

const planRow = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1",
  kind: "ASSET",
  label: "Vanguard ISA",
  linkId: "a1",
  value: 42300,
  ...over,
});

const realityRow = (over: Partial<RealityRow> = {}): RealityRow => ({
  linkId: "a1",
  kind: "ASSET",
  label: "Vanguard ISA",
  value: 42300,
  ...over,
});

describe("resolvePlanSync", () => {
  it("leaves a row that already matches", () => {
    const result = resolvePlanSync([planRow()], [realityRow()]);
    expect(result).toEqual({
      updates: [],
      additions: [],
      removals: [],
      unchanged: ["p1"],
    });
  });

  it("updates a row whose value has moved", () => {
    const result = resolvePlanSync([planRow({ value: 80000 })], [realityRow()]);
    expect(result.updates).toEqual([
      { id: "p1", value: 42300, label: "Vanguard ISA" },
    ]);
    expect(result.unchanged).toEqual([]);
  });

  // Sync overwrites regardless of why the row differs — a deliberate what-if
  // and a stale value are treated identically.
  it("updates a row the user deliberately changed", () => {
    const result = resolvePlanSync(
      [planRow({ value: 999999 })],
      [realityRow()],
    );
    expect(result.updates).toHaveLength(1);
  });

  it("updates a row whose label changed, keeping the same link", () => {
    const result = resolvePlanSync(
      [planRow()],
      [realityRow({ label: "Vanguard S&S ISA" })],
    );
    expect(result.updates).toEqual([
      { id: "p1", value: 42300, label: "Vanguard S&S ISA" },
    ]);
  });

  it("adds a row for something the plan does not have", () => {
    const extra = realityRow({
      linkId: "a2",
      label: "Premium bonds",
      value: 5000,
    });
    const result = resolvePlanSync([planRow()], [realityRow(), extra]);
    expect(result.additions).toEqual([extra]);
  });

  // An archived or hard-deleted account is simply absent from `reality`.
  it("removes a row whose account is gone", () => {
    const result = resolvePlanSync([planRow()], []);
    expect(result.removals).toEqual([
      { id: "p1", label: "Vanguard ISA", reason: "gone" },
    ]);
  });

  it("removes a plan-only row", () => {
    const invented = planRow({
      id: "p2",
      linkId: null,
      label: "Buy-to-let at 50",
    });
    const result = resolvePlanSync([planRow(), invented], [realityRow()]);
    expect(result.removals).toEqual([
      { id: "p2", label: "Buy-to-let at 50", reason: "plan-only" },
    ]);
    expect(result.unchanged).toEqual(["p1"]);
  });

  // The same id can exist as both an account and a category, and an asset row
  // must never resolve against an income. Kind is part of the identity.
  it("does not match rows of different kinds sharing a link id", () => {
    const income = planRow({ id: "p3", kind: "INCOME", label: "Salary" });
    const result = resolvePlanSync([income], [realityRow()]);
    expect(result.removals).toEqual([
      { id: "p3", label: "Salary", reason: "gone" },
    ]);
    expect(result.additions).toHaveLength(1);
  });

  it("handles an empty plan by adding everything", () => {
    const result = resolvePlanSync([], [realityRow()]);
    expect(result.additions).toHaveLength(1);
    expect(result.updates).toEqual([]);
    expect(result.removals).toEqual([]);
  });

  it("reports nothing to do for an empty plan and empty reality", () => {
    expect(syncChangeCount(resolvePlanSync([], []))).toBe(0);
  });

  it("counts every change once", () => {
    const result = resolvePlanSync(
      [planRow({ value: 1 }), planRow({ id: "p2", linkId: null })],
      [realityRow(), realityRow({ linkId: "a2" })],
    );
    expect(syncChangeCount(result)).toBe(3); // 1 update, 1 addition, 1 removal
  });
});

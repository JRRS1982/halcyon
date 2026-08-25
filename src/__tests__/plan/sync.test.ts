import {
  type PlanRow,
  type RealityDefaults,
  type RealityRow,
  resolvePlanSync,
  syncChangeCount,
} from "@/lib/plan/sync";

const NO_DEFAULTS: RealityDefaults = {
  drawdownPriority: null,
  incomeKind: null,
  expenseCategory: null,
};

const planRow = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1",
  kind: "ASSET",
  label: "Vanguard ISA",
  linkId: "a1",
  value: 42300,
  wrapper: "ISA",
  ...over,
});

const realityRow = (over: Partial<RealityRow> = {}): RealityRow => ({
  linkId: "a1",
  kind: "ASSET",
  label: "Vanguard ISA",
  value: 42300,
  wrapper: "ISA",
  defaults: { ...NO_DEFAULTS, drawdownPriority: 2 },
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
      { id: "p1", value: 42300, label: "Vanguard ISA", wrapper: "ISA" },
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
      { id: "p1", value: 42300, label: "Vanguard S&S ISA", wrapper: "ISA" },
    ]);
  });

  // Wrapper is classification, not an assumption: changing an account from a
  // cash ISA to a stocks & shares ISA on the balance sheet must follow the
  // plan through, exactly as a label change does — the same argument that
  // makes the label sync.
  it("updates a row whose wrapper changed, even with value and label unchanged", () => {
    const result = resolvePlanSync(
      [planRow()],
      [realityRow({ wrapper: "GIA" })],
    );
    expect(result.updates).toEqual([
      { id: "p1", value: 42300, label: "Vanguard ISA", wrapper: "GIA" },
    ]);
    expect(result.unchanged).toEqual([]);
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
  // The spec's Kept list holds drawdown priority and start/end ages: a Sync
  // must never reset an assumption the user tuned. `defaults` therefore takes
  // no part in the equality check — it only gives an *addition* a starting
  // point — and a row differing solely there is still unchanged.
  it("never updates a row because its reality defaults differ", () => {
    const result = resolvePlanSync(
      [planRow()],
      [
        realityRow({
          defaults: { ...NO_DEFAULTS, drawdownPriority: 9 },
        }),
      ],
    );
    expect(result.updates).toEqual([]);
    expect(result.unchanged).toEqual(["p1"]);
  });

  // provisionUserSettings seeds ~17 starter budget categories at £0, so
  // without this a brand-new user's first plan opens on a table of empty
  // lines. seed.ts skipped them for exactly this reason.
  it("does not add a row worth nothing", () => {
    const result = resolvePlanSync(
      [],
      [realityRow({ linkId: "c1", kind: "EXPENSE", value: 0, wrapper: null })],
    );
    expect(result.additions).toEqual([]);
    expect(syncChangeCount(result)).toBe(0);
  });

  it("does not add a row worth less than nothing", () => {
    const result = resolvePlanSync([], [realityRow({ value: -50 })]);
    expect(result.additions).toEqual([]);
  });

  // The guard is on additions alone. Filtering zeros out of *reality* would
  // make a paid-off mortgage absent, and an absent row is a removal — which
  // would delete the row and the user's tuned assumptions with it, silently,
  // since the confirmation dialog only names plan-only rows.
  it("updates a linked row whose value has fallen to zero rather than removing it", () => {
    const result = resolvePlanSync(
      [planRow({ kind: "LIABILITY", wrapper: null, value: 1200 })],
      [realityRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
    );
    expect(result.removals).toEqual([]);
    expect(result.updates).toEqual([
      { id: "p1", value: 0, label: "Vanguard ISA", wrapper: null },
    ]);
  });

  it("leaves an already-zero linked row alone rather than removing it", () => {
    const result = resolvePlanSync(
      [planRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
      [realityRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
    );
    expect(result.removals).toEqual([]);
    expect(result.unchanged).toEqual(["p1"]);
  });
});

import {
  type DependentRow,
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
  dependsOn: null,
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

// Most cases here have no dependent events; this wrapper defaults that third
// argument so each test states only what it is about.
const resolve = (
  rows: PlanRow[],
  reality: RealityRow[],
  dependents: DependentRow[] = [],
) => resolvePlanSync(rows, reality, dependents);

describe("resolvePlanSync", () => {
  it("leaves a row that already matches", () => {
    const result = resolve([planRow()], [realityRow()]);
    expect(result).toEqual({
      updates: [],
      additions: [],
      removals: [],
      unchanged: ["p1"],
    });
  });

  it("updates a row whose value has moved", () => {
    const result = resolve([planRow({ value: 80000 })], [realityRow()]);
    expect(result.updates).toEqual([
      { id: "p1", value: 42300, label: "Vanguard ISA", wrapper: "ISA" },
    ]);
    expect(result.unchanged).toEqual([]);
  });

  // Sync overwrites regardless of why the row differs — a deliberate what-if
  // and a stale value are treated identically.
  it("updates a row the user deliberately changed", () => {
    const result = resolve([planRow({ value: 999999 })], [realityRow()]);
    expect(result.updates).toHaveLength(1);
  });

  it("updates a row whose label changed, keeping the same link", () => {
    const result = resolve(
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
    const result = resolve([planRow()], [realityRow({ wrapper: "GIA" })]);
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
    const result = resolve([planRow()], [realityRow(), extra]);
    expect(result.additions).toEqual([extra]);
  });

  // An archived or hard-deleted account is simply absent from `reality`.
  it("removes a row whose account is gone", () => {
    const result = resolve([planRow()], []);
    expect(result.removals).toEqual([
      { id: "p1", label: "Vanguard ISA", reason: "gone", dependsOn: null },
    ]);
  });

  it("removes a plan-only row", () => {
    const invented = planRow({
      id: "p2",
      linkId: null,
      label: "Buy-to-let at 50",
    });
    const result = resolve([planRow(), invented], [realityRow()]);
    expect(result.removals).toEqual([
      {
        id: "p2",
        label: "Buy-to-let at 50",
        reason: "plan-only",
        dependsOn: null,
      },
    ]);
    expect(result.unchanged).toEqual(["p1"]);
  });

  // The same id can exist as both an account and a category, and an asset row
  // must never resolve against an income. Kind is part of the identity.
  it("does not match rows of different kinds sharing a link id", () => {
    const income = planRow({ id: "p3", kind: "INCOME", label: "Salary" });
    const result = resolve([income], [realityRow()]);
    expect(result.removals).toEqual([
      { id: "p3", label: "Salary", reason: "gone", dependsOn: null },
    ]);
    expect(result.additions).toHaveLength(1);
  });

  it("handles an empty plan by adding everything", () => {
    const result = resolve([], [realityRow()]);
    expect(result.additions).toHaveLength(1);
    expect(result.updates).toEqual([]);
    expect(result.removals).toEqual([]);
  });

  it("reports nothing to do for an empty plan and empty reality", () => {
    expect(syncChangeCount(resolve([], []))).toBe(0);
  });

  it("counts every change once", () => {
    const result = resolve(
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
    const result = resolve(
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
    const result = resolve(
      [],
      [realityRow({ linkId: "c1", kind: "EXPENSE", value: 0, wrapper: null })],
    );
    expect(result.additions).toEqual([]);
    expect(syncChangeCount(result)).toBe(0);
  });

  it("does not add a row worth less than nothing", () => {
    const result = resolve([], [realityRow({ value: -50 })]);
    expect(result.additions).toEqual([]);
  });

  // The guard is on additions alone. Filtering zeros out of *reality* would
  // make a paid-off mortgage absent, and an absent row is a removal — which
  // would delete the row and the user's tuned assumptions with it, silently,
  // since the confirmation dialog only names plan-only rows.
  it("updates a linked row whose value has fallen to zero rather than removing it", () => {
    const result = resolve(
      [planRow({ kind: "LIABILITY", wrapper: null, value: 1200 })],
      [realityRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
    );
    expect(result.removals).toEqual([]);
    expect(result.updates).toEqual([
      { id: "p1", value: 0, label: "Vanguard ISA", wrapper: null },
    ]);
  });

  it("leaves an already-zero linked row alone rather than removing it", () => {
    const result = resolve(
      [planRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
      [realityRow({ kind: "LIABILITY", wrapper: null, value: 0 })],
    );
    expect(result.removals).toEqual([]);
    expect(result.unchanged).toEqual(["p1"]);
  });
});

// A mortgaged property is three rows and an event, each of which cannot
// outlive the one above it: the mortgage needs its property, the repayment
// needs its mortgage, the sale needs something to sell. Removing only the row
// reality lost leaves the rest behind — a mortgage on a house that is gone,
// and a PROPERTY_SALE whose assetId the FK has nulled, which project.ts skips
// in three places and EventsTable renders as a sale of "?".
describe("resolvePlanSync cascades", () => {
  const house = planRow({
    id: "asset-house",
    label: "The house",
    linkId: "acct-house",
    wrapper: "PROPERTY",
    value: 400000,
  });
  const houseReality = realityRow({
    linkId: "acct-house",
    label: "The house",
    wrapper: "PROPERTY",
    value: 400000,
  });
  const mortgage = planRow({
    id: "liab-mortgage",
    kind: "LIABILITY",
    label: "Halifax mortgage",
    linkId: "acct-mortgage",
    wrapper: null,
    value: 180000,
    dependsOn: "asset-house",
  });
  const mortgageReality = realityRow({
    kind: "LIABILITY",
    linkId: "acct-mortgage",
    label: "Halifax mortgage",
    wrapper: null,
    value: 180000,
  });
  // linkRepaymentExpense sets no categoryId, so a real repayment expense is
  // always plan-only as well as dependent — the overlap this must not
  // double-count.
  const repayment = planRow({
    id: "exp-repayment",
    kind: "EXPENSE",
    label: "Halifax mortgage repayment",
    linkId: null,
    wrapper: null,
    value: 12000,
    dependsOn: "liab-mortgage",
  });
  const sale: DependentRow = {
    id: "evt-sale",
    label: "Sell the house at 60",
    dependsOn: "asset-house",
  };

  it("takes the mortgage, its repayment and the sale event when the property's account is gone", () => {
    const result = resolve(
      [house, mortgage, repayment],
      [mortgageReality],
      [sale],
    );

    expect(result.removals).toEqual([
      {
        id: "asset-house",
        label: "The house",
        reason: "gone",
        dependsOn: null,
      },
      {
        id: "exp-repayment",
        label: "Halifax mortgage repayment",
        reason: "plan-only",
        dependsOn: null,
      },
      {
        id: "liab-mortgage",
        label: "Halifax mortgage",
        reason: "cascade",
        dependsOn: "asset-house",
      },
      {
        id: "evt-sale",
        label: "Sell the house at 60",
        reason: "cascade",
        dependsOn: "asset-house",
      },
    ]);
    expect(result.unchanged).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  // Three deep: property → mortgage → repayment. A hand-rolled two levels
  // would leave the third behind.
  it("follows the chain transitively", () => {
    const linkedRepayment = planRow({
      id: "exp-repayment",
      kind: "EXPENSE",
      label: "Halifax mortgage repayment",
      linkId: "cat-repay",
      wrapper: null,
      value: 12000,
      dependsOn: "liab-mortgage",
    });
    const repaymentReality = realityRow({
      kind: "EXPENSE",
      linkId: "cat-repay",
      label: "Halifax mortgage repayment",
      wrapper: null,
      value: 12000,
    });

    const result = resolve(
      [house, mortgage, linkedRepayment],
      [mortgageReality, repaymentReality],
      [sale],
    );

    expect(result.removals.map((r) => [r.id, r.reason])).toEqual([
      ["asset-house", "gone"],
      ["liab-mortgage", "cascade"],
      ["evt-sale", "cascade"],
      ["exp-repayment", "cascade"],
    ]);
    expect(result.unchanged).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  // The button's number is the promise the dialog then itemises: a row that is
  // both plan-only and dragged must be removed once and counted once.
  it("removes a row that is both plan-only and dragged exactly once", () => {
    const result = resolve(
      [house, mortgage, repayment],
      [mortgageReality],
      [sale],
    );

    const ids = result.removals.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === "exp-repayment")).toHaveLength(1);
    expect(syncChangeCount(result)).toBe(result.removals.length);
    expect(syncChangeCount(result)).toBe(4);
  });

  it("leaves dependents alone when the row they depend on survives", () => {
    const result = resolve(
      [house, mortgage],
      [houseReality, mortgageReality],
      [sale],
    );

    expect(result.removals).toEqual([]);
    expect(result.unchanged).toEqual(["asset-house", "liab-mortgage"]);
  });

  it("cascades nothing from a gone row nothing depends on", () => {
    const result = resolve([planRow()], [], [sale]);

    expect(result.removals).toEqual([
      { id: "p1", label: "Vanguard ISA", reason: "gone", dependsOn: null },
    ]);
  });

  // A row about to be deleted must not also be reported as an update: the
  // breakdown would count it twice and applySyncPlan would write it and then
  // throw it away.
  it("drops a dragged row out of updates", () => {
    const result = resolve(
      [house, mortgage],
      [
        realityRow({
          kind: "LIABILITY",
          linkId: "acct-mortgage",
          label: "Halifax mortgage",
          wrapper: null,
          value: 175000,
        }),
      ],
      [],
    );

    expect(result.updates).toEqual([]);
    expect(result.removals.map((r) => r.id)).toEqual([
      "asset-house",
      "liab-mortgage",
    ]);
    expect(syncChangeCount(result)).toBe(2);
  });

  // The cascade fires from a "gone" removal as readily as a plan-only one, and
  // stops where the dependency does: the sale event hangs off the property,
  // which is still here.
  it("cascades from a gone dependent without touching its siblings", () => {
    const result = resolve(
      [house, mortgage, repayment],
      [houseReality],
      [sale],
    );

    expect(result.removals.map((r) => [r.id, r.reason])).toEqual([
      ["liab-mortgage", "gone"],
      ["exp-repayment", "plan-only"],
    ]);
    expect(result.unchanged).toEqual(["asset-house"]);
  });
});

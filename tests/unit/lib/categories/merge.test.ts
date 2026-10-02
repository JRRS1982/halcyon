import { planItemMerge } from "@/lib/categories/merge";

const item = (id: string, periodId: string, budget: number) => ({
  id,
  periodId,
  budget,
});

describe("planItemMerge", () => {
  test("repoints source items in periods the survivor has no row in", () => {
    const plan = planItemMerge(
      [item("s1", "mar", 100), item("s2", "apr", 50)],
      {}, // survivor has no rows
    );
    expect(plan.repointIds).toEqual(["s1", "s2"]);
    expect(plan.combine).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
  });

  test("combines budgets and deletes the source row on a same-period collision", () => {
    const plan = planItemMerge([item("s1", "mar", 100)], { mar: "v1" });
    expect(plan.repointIds).toEqual([]);
    expect(plan.combine).toEqual([{ survivorItemId: "v1", addBudget: 100 }]);
    expect(plan.deleteIds).toEqual(["s1"]);
  });

  test("handles a mix of collisions and clean repoints", () => {
    const plan = planItemMerge(
      [item("s1", "mar", 100), item("s2", "apr", 50)],
      { mar: "v1" }, // collision in March only
    );
    expect(plan.repointIds).toEqual(["s2"]);
    expect(plan.combine).toEqual([{ survivorItemId: "v1", addBudget: 100 }]);
    expect(plan.deleteIds).toEqual(["s1"]);
  });

  test("empty source produces an empty plan", () => {
    expect(planItemMerge([], { mar: "v1" })).toEqual({
      repointIds: [],
      combine: [],
      deleteIds: [],
    });
  });
});

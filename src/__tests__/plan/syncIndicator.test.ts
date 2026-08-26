import { indicatorFor } from "@/app/(app)/plan/syncIndicator";
import type { SyncPlan } from "@/lib/plan/sync";

const plan: SyncPlan = {
  updates: [
    { id: "p1", value: 42300, label: "Vanguard ISA", wrapper: null, flow: 0 },
  ],
  additions: [],
  removals: [
    { id: "p2", label: "Buy-to-let", reason: "plan-only", dependsOn: null },
  ],
  unchanged: ["p3"],
};

describe("indicatorFor", () => {
  test("a row in updates differs from reality", () => {
    expect(indicatorFor("p1", plan)).toBe("changed");
  });

  test("a plan-only row is marked as such, not as changed", () => {
    expect(indicatorFor("p2", plan)).toBe("plan-only");
  });

  test("an unchanged row is synced", () => {
    expect(indicatorFor("p3", plan)).toBe("synced");
  });

  // A row removed because its account is gone reads as plan-only to the user:
  // in both cases Sync will delete it, and the marker's job is to say so.
  test("a row whose account is gone reads as plan-only", () => {
    const gone: SyncPlan = {
      ...plan,
      removals: [
        { id: "p4", label: "Old car", reason: "gone", dependsOn: null },
      ],
    };
    expect(indicatorFor("p4", gone)).toBe("plan-only");
  });

  // A dragged row is not plan-only: it may well be on the balance sheet — a
  // mortgage whose account is live, going only because its property is not.
  // Marking it "◇ not on your balance sheet" would be a false statement about
  // a row that is on it, and the marker is one of the three renderings of this
  // same object.
  test("a row dragged off by another reads as attached, not plan-only", () => {
    const dragged: SyncPlan = {
      ...plan,
      removals: [
        { id: "a1", label: "The house", reason: "gone", dependsOn: null },
        {
          id: "l1",
          label: "Halifax mortgage",
          reason: "cascade",
          dependsOn: "a1",
        },
      ],
    };
    expect(indicatorFor("l1", dragged)).toBe("attached");
    expect(indicatorFor("a1", dragged)).toBe("plan-only");
  });

  test("an unknown row is treated as synced rather than throwing", () => {
    expect(indicatorFor("nope", plan)).toBe("synced");
  });
});

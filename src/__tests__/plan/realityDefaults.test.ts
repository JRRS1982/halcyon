import { drawdownPriorityFor, incomeKindFor } from "@/lib/plan/realityDefaults";

// These two maps were carried by the deleted src/lib/plan/seed.ts and dropped
// when creating a plan became a Sync. They are addition-time starting points,
// never re-applied to an existing row — see RealityDefaults in sync.ts.
describe("drawdownPriorityFor", () => {
  it("draws cash first and property last", () => {
    expect(drawdownPriorityFor("CURRENT")).toBe(0);
    expect(drawdownPriorityFor("MEDIUM_TERM")).toBe(1);
    expect(drawdownPriorityFor("LONG_TERM")).toBe(2);
    expect(drawdownPriorityFor("OTHER")).toBe(3);
    expect(drawdownPriorityFor("PROPERTY")).toBe(9);
  });

  // Account.category is nullable, unlike the BalanceItem.category seed.ts read.
  it("treats an account with no term bucket as OTHER", () => {
    expect(drawdownPriorityFor(null)).toBe(3);
  });
});

describe("incomeKindFor", () => {
  it("maps each budget income section to a plan income kind", () => {
    expect(incomeKindFor("SALARY")).toBe("SALARY");
    expect(incomeKindFor("PENSIONS")).toBe("DB_PENSION");
    expect(incomeKindFor("SIDE_INCOME")).toBe("SELF_EMPLOYMENT");
    expect(incomeKindFor("INVESTMENTS")).toBe("OTHER");
    expect(incomeKindFor("OTHER")).toBe("OTHER");
  });

  it("reads an expense section reaching here as OTHER rather than crashing", () => {
    expect(incomeKindFor("FIXED")).toBe("OTHER");
  });
});

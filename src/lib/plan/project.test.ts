// src/lib/plan/project.test.ts
import {
  earliestSustainableRetirementAge,
  project,
  projectWithBand,
} from "./project";
import type { PlanInput, PlanProjection, YearProjection } from "./types";

const at = (p: PlanProjection, i: number): YearProjection => {
  const y = p.years[i];
  if (!y) throw new Error(`no projection year at index ${i}`);
  return y;
};

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  currentAge: 40,
  startYear: 2026,
  retirementAge: 65,
  planToAge: 41,
  inflationPct: 0,
  defaultReturnPct: 0,
  taxRatePct: 0,
  assets: [],
  liabilities: [],
  incomes: [],
  expenses: [],
  events: [],
  ...over,
});

const wrapperTotal = (
  y: { assets: { wrapper: string; value: number }[] },
  w: string,
): number =>
  y.assets.filter((a) => a.wrapper === w).reduce((s, a) => s + a.value, 0);

describe("project", () => {
  it("emits one row per year with calendar years", () => {
    const p = project(base({ currentAge: 40, planToAge: 42 }));
    expect(p.years.map((y) => y.age)).toEqual([40, 41, 42]);
    expect(p.years.map((y) => y.year)).toEqual([2026, 2027, 2028]);
  });

  it("grows an untouched asset by default return; per-asset override wins", () => {
    const p = project(
      base({
        planToAge: 40,
        defaultReturnPct: 10,
        assets: [
          {
            id: "a",
            label: "GIA",
            wrapper: "GIA",
            openingValue: 10000,
            drawdownPriority: 1,
          },
          {
            id: "b",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 10000,
            expectedReturnPct: 0,
            drawdownPriority: 2,
          },
        ],
      }),
    );
    expect(wrapperTotal(at(p, 0), "GIA")).toBe(11000);
    expect(wrapperTotal(at(p, 0), "PENSION")).toBe(10000);
  });

  it("leftover surplus sits in the CASH buffer, not the pension", () => {
    const p = project(
      base({
        planToAge: 40,
        incomes: [
          {
            id: "s",
            label: "Salary",
            kind: "SALARY",
            annualAmount: 50000,
            growth: { kind: "NONE" },
            taxable: true,
          },
        ],
        expenses: [
          {
            id: "e",
            label: "Living",
            annualAmount: 30000,
            inflationLinked: false,
          },
        ],
        taxRatePct: 20,
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 0,
            drawdownPriority: 5,
          },
        ],
      }),
    );
    expect(at(p, 0).surplus).toBe(10000);
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(10000);
    expect(wrapperTotal(at(p, 0), "PENSION")).toBe(0);
  });

  it("applies a per-asset contribution into its pot and records it", () => {
    const p = project(
      base({
        planToAge: 40,
        retirementAge: 65,
        incomes: [
          {
            id: "s",
            label: "Salary",
            kind: "SALARY",
            annualAmount: 40000,
            growth: { kind: "NONE" },
            taxable: false,
          },
        ],
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 0,
            annualContribution: 6000,
            drawdownPriority: 5,
          },
        ],
      }),
    );
    expect(at(p, 0).contributions).toBe(6000);
    expect(wrapperTotal(at(p, 0), "PENSION")).toBe(6000);
    expect(at(p, 0).assets.find((a) => a.id === "sipp")?.contributed).toBe(
      6000,
    );
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(34000);
  });

  it("funds a deficit from the cash buffer and flags shortfall when exhausted", () => {
    const p = project(
      base({
        planToAge: 40,
        expenses: [
          {
            id: "e",
            label: "Living",
            annualAmount: 30000,
            inflationLinked: false,
          },
        ],
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 20000,
            drawdownPriority: 0,
          },
        ],
      }),
    );
    expect(at(p, 0).withdrawals).toBe(20000);
    expect(at(p, 0).shortfall).toBe(true);
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(0);
  });

  it("taxes a pension drawdown (gross-up) and records it on the asset", () => {
    const p = project(
      base({
        planToAge: 40,
        taxRatePct: 20,
        expenses: [
          {
            id: "e",
            label: "Living",
            annualAmount: 8000,
            inflationLinked: false,
          },
        ],
        assets: [
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 50000,
            drawdownPriority: 0,
          },
        ],
      }),
    );
    expect(at(p, 0).withdrawals).toBe(10000);
    expect(at(p, 0).tax).toBe(2000);
    expect(at(p, 0).assets.find((a) => a.id === "sipp")?.withdrawn).toBe(10000);
  });

  it("captures income by kind", () => {
    const p = project(
      base({
        planToAge: 40,
        incomes: [
          {
            id: "s",
            label: "Salary",
            kind: "SALARY",
            annualAmount: 40000,
            growth: { kind: "NONE" },
            taxable: true,
          },
        ],
        statePension: { startAge: 40, annualAmount: 11000 },
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
        ],
      }),
    );
    expect(at(p, 0).incomeByKind.SALARY).toBe(40000);
    expect(at(p, 0).incomeByKind.STATE_PENSION).toBe(11000);
  });

  it("reduces net worth by an outstanding liability", () => {
    const p = project(
      base({
        planToAge: 40,
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 100000,
            drawdownPriority: 0,
          },
        ],
        liabilities: [
          {
            id: "m",
            label: "Mortgage",
            openingBalance: 60000,
            interestPct: 0,
            monthlyRepayment: 0,
          },
        ],
      }),
    );
    expect(at(p, 0).liabilitiesTotal).toBe(60000);
    expect(at(p, 0).netWorth).toBe(40000);
  });

  it("applies a one-off inflow event the year it lands", () => {
    const p = project(
      base({
        currentAge: 40,
        planToAge: 41,
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
        ],
        events: [
          {
            id: "inh",
            label: "Inheritance",
            age: 41,
            direction: "INFLOW",
            amount: 50000,
          },
        ],
      }),
    );
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(0);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(50000);
  });
});

describe("earliestSustainableRetirementAge", () => {
  it("finds the earliest age at which stopping salary keeps the plan feasible", () => {
    const input = base({
      currentAge: 60,
      planToAge: 65,
      retirementAge: 65,
      taxRatePct: 0,
      incomes: [
        {
          id: "s",
          label: "Salary",
          kind: "SALARY",
          annualAmount: 40000,
          growth: { kind: "NONE" },
          taxable: false,
        },
      ],
      expenses: [
        {
          id: "e",
          label: "Living",
          annualAmount: 20000,
          inflationLinked: false,
        },
      ],
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 40000,
          drawdownPriority: 0,
        },
      ],
    });
    const age = earliestSustainableRetirementAge(input);
    expect(age).not.toBeNull();
    expect(age).toBeGreaterThanOrEqual(60);
    expect(age).toBeLessThanOrEqual(65);
  });

  it("returns currentAge when already feasible with no work", () => {
    const input = base({
      currentAge: 60,
      planToAge: 62,
      taxRatePct: 0,
      expenses: [
        {
          id: "e",
          label: "Living",
          annualAmount: 10000,
          inflationLinked: false,
        },
      ],
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 1000000,
          drawdownPriority: 0,
        },
      ],
    });
    expect(earliestSustainableRetirementAge(input)).toBe(60);
  });

  it("returns null when no retirement age in range is feasible", () => {
    const input = base({
      currentAge: 60,
      planToAge: 90,
      taxRatePct: 0,
      expenses: [
        {
          id: "e",
          label: "Living",
          annualAmount: 50000,
          inflationLinked: false,
        },
      ],
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 1000,
          drawdownPriority: 0,
        },
      ],
    });
    expect(earliestSustainableRetirementAge(input)).toBeNull();
  });

  it("is wired into project()'s verdict", () => {
    const input = base({
      currentAge: 60,
      planToAge: 62,
      taxRatePct: 0,
      expenses: [
        {
          id: "e",
          label: "Living",
          annualAmount: 10000,
          inflationLinked: false,
        },
      ],
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 1000000,
          drawdownPriority: 0,
        },
      ],
    });
    expect(project(input).verdict.earliestSustainableRetirementAge).toBe(60);
  });
});

describe("contribution funding (no leak)", () => {
  it("does not fund a contribution by liquidating a taxable pot", () => {
    const p = project(
      base({
        planToAge: 40,
        taxRatePct: 40,
        assets: [
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 0,
            annualContribution: 10000,
            drawdownPriority: 0,
          },
          {
            id: "gia",
            label: "GIA",
            wrapper: "GIA",
            openingValue: 100000,
            drawdownPriority: 1,
          },
        ],
      }),
    );
    expect(at(p, 0).tax).toBe(0);
    expect(at(p, 0).withdrawals).toBe(0);
    expect(at(p, 0).contributions).toBe(0);
    expect(wrapperTotal(at(p, 0), "GIA")).toBe(100000);
  });

  it("scales contributions down to the cash flow available", () => {
    const p = project(
      base({
        planToAge: 40,
        taxRatePct: 0,
        incomes: [
          {
            id: "s",
            label: "Salary",
            kind: "SALARY",
            annualAmount: 5000,
            growth: { kind: "NONE" },
            taxable: false,
          },
        ],
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 0,
            annualContribution: 8000,
            drawdownPriority: 5,
          },
        ],
      }),
    );
    expect(at(p, 0).contributions).toBe(5000);
    expect(wrapperTotal(at(p, 0), "PENSION")).toBe(5000);
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(0);
  });
});

describe("no-asset cash home", () => {
  it("does not lose surplus when the plan has no assets", () => {
    const p = project(
      base({
        currentAge: 40,
        planToAge: 41,
        assets: [],
        events: [
          {
            id: "inh",
            label: "Inheritance",
            age: 41,
            direction: "INFLOW",
            amount: 50000,
          },
        ],
      }),
    );
    expect(at(p, 1).netWorth).toBe(50000);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(50000);
  });
});

describe("projectWithBand", () => {
  const banded = (over: Partial<PlanInput> = {}) =>
    base({
      planToAge: 60,
      defaultReturnPct: 5,
      returnSpreadPct: 2,
      assets: [
        {
          id: "a",
          label: "GIA",
          wrapper: "GIA",
          openingValue: 100000,
          drawdownPriority: 1,
        },
      ],
      ...over,
    });

  it("mid pass equals plain project()", () => {
    const input = banded();
    const b = projectWithBand(input);
    expect(b.mid.years).toEqual(project(input).years);
  });

  it("high pass beats mid beats low on net worth every year", () => {
    const b = projectWithBand(banded());
    for (let i = 0; i < b.mid.years.length; i++) {
      const lo = at(b.low, i).netWorth;
      const mid = at(b.mid, i).netWorth;
      const hi = at(b.high, i).netWorth;
      expect(lo).toBeLessThanOrEqual(mid);
      expect(mid).toBeLessThanOrEqual(hi);
    }
  });

  it("collapses to three identical passes when spread is 0", () => {
    const b = projectWithBand(banded({ returnSpreadPct: 0 }));
    expect(b.low.years).toEqual(b.mid.years);
    expect(b.high.years).toEqual(b.mid.years);
  });

  it("treats absent spread as 0", () => {
    const input = banded({ returnSpreadPct: undefined });
    const b = projectWithBand(input);
    expect(b.low.years).toEqual(b.mid.years);
  });
});

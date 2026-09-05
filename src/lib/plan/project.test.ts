// src/lib/plan/project.test.ts
import { taxOn } from "@/lib/tax/compute";
import { project, projectWithBand } from "./project";
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
  taxRegime: "RUK",
  thresholdsInflationLinked: true,
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
    // 50000 − 12570 allowance = 37430 taxable, all inside the 20% band
    // (which ends at 37700): tax 7486, net 42514, less 30000 spent = 12514.
    expect(at(p, 0).surplus).toBe(12514);
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(12514);
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
            monthlyContribution: 500,
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

  const drawdown = (spend: number) =>
    project(
      base({
        planToAge: 40,
        expenses: [
          {
            id: "e",
            label: "Living",
            annualAmount: spend,
            inflationLinked: false,
          },
        ],
        assets: [
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 50000,
            minAccessAge: 40, // explicitly accessible at test age 40
            drawdownPriority: 0,
          },
        ],
      }),
    );

  it("does not tax a drawdown that fits inside the unused personal allowance", () => {
    // No income at all, so all 12570 of the allowance is free: 8000 out is
    // 8000 in hand, and there is nothing to gross up.
    const p = drawdown(8000);
    expect(at(p, 0).withdrawals).toBe(8000);
    expect(at(p, 0).tax).toBe(0);
    expect(at(p, 0).assets.find((a) => a.id === "sipp")?.withdrawn).toBe(8000);
  });

  it("grosses up a pension drawdown past the allowance and records it", () => {
    // 22570 needed net: the first 12570 comes out of the allowance untaxed,
    // the remaining 10000 net costs 12500 gross at 20% (10000 / 0.8). Total
    // gross 25070, tax 2500.
    const p = drawdown(22570);
    expect(at(p, 0).withdrawals).toBe(25070);
    expect(at(p, 0).tax).toBe(2500);
    expect(at(p, 0).assets.find((a) => a.id === "sipp")?.withdrawn).toBe(25070);
  });

  // The defect this closes: the year's income and the year's withdrawal used to
  // be taxed by two independent calculations, so the personal allowance was
  // granted twice and both sat low in the bands. One year is one income.
  it("taxes income and a withdrawal as one income, not two", () => {
    const income = 20000;
    const p = project(
      base({
        planToAge: 40,
        incomes: [
          {
            id: "s",
            label: "Salary",
            kind: "SALARY",
            annualAmount: income,
            growth: { kind: "NONE" },
            taxable: true,
          },
        ],
        // 20000 gross − 1486 tax = 18514 net, so a 48514 expense leaves a
        // 30000 net deficit for the pension to fund.
        expenses: [
          {
            id: "e",
            label: "Living",
            annualAmount: 48514,
            inflationLinked: false,
          },
        ],
        assets: [
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 200000,
            minAccessAge: 40,
            drawdownPriority: 0,
          },
        ],
      }),
    );
    const y = at(p, 0);
    expect(y.shortfall).toBe(false);
    expect(y.withdrawals).toBe(39910);
    expect(y.tax).toBe(
      taxOn({
        income: income + y.withdrawals,
        year: "2025/26",
        regime: "RUK",
        thresholdScale: 1,
      }).tax,
    );
  });

  // The anchor is what pins this: startYear 2026 means year 0's projection
  // year is 2026 itself, so its thresholdScale is 1 regardless of the toggle
  // — the two runs must agree there. Beyond the anchor, frozen thresholds
  // fall behind an income that keeps inflating, so tax must be strictly
  // higher unlinked (equivalently, strictly lower linked) by the last year.
  it("thresholdsInflationLinked leaves year 0 tax unchanged but strictly lowers late-year tax", () => {
    const scenario = (thresholdsInflationLinked: boolean) =>
      project(
        base({
          planToAge: 60,
          inflationPct: 3,
          thresholdsInflationLinked,
          incomes: [
            {
              id: "s",
              label: "Salary",
              kind: "SALARY",
              annualAmount: 90_000,
              growth: { kind: "INFLATION" },
              taxable: true,
            },
          ],
        }),
      );

    const linked = scenario(true);
    const frozen = scenario(false);

    expect(at(linked, 0).tax).toBe(at(frozen, 0).tax);

    const lastIndex = linked.years.length - 1;
    expect(at(linked, lastIndex).tax).toBeLessThan(at(frozen, lastIndex).tax);
  });

  // Regime must travel from PlanInput through taxContextFor into the walk —
  // nothing here proves that unless the two regimes actually disagree, so the
  // income is chosen high enough that they diverge (low down they're
  // identical). Hand-derived from src/lib/tax/bands.ts against taxable income
  // of 90,000 − 12,570 = 77,430:
  //   RUK falls in the 40% band (37,700 → 87,430):
  //     37,700 × 0.20 + (77,430 − 37,700) × 0.40 = 7,540 + 15,892 = 23,432.
  //   SCOTLAND fills starter/basic/intermediate/higher, then 15,000 of the
  //   45% advanced band (62,430 → 87,430):
  //     2,827 × 0.19 + 12,094 × 0.20 + 16,171 × 0.21 + 31,338 × 0.42
  //       + 15,000 × 0.45
  //     = 537.13 + 2,418.80 + 3,395.91 + 13,161.96 + 6,750 = 26,263.80,
  //     rounds to 26,264.
  it("SCOTLAND taxes a year's income differently from RUK, and matches taxOn", () => {
    const income = 90_000;
    const scenario = (taxRegime: "RUK" | "SCOTLAND") =>
      project(
        base({
          planToAge: 40,
          taxRegime,
          incomes: [
            {
              id: "s",
              label: "Salary",
              kind: "SALARY",
              annualAmount: income,
              growth: { kind: "NONE" },
              taxable: true,
            },
          ],
        }),
      );

    const scotland = scenario("SCOTLAND");
    const ruk = scenario("RUK");

    expect(at(scotland, 0).tax).toBe(
      taxOn({ income, year: "2025/26", regime: "SCOTLAND", thresholdScale: 1 })
        .tax,
    );
    expect(at(scotland, 0).tax).toBe(26264);
    expect(at(ruk, 0).tax).toBe(23432);
    expect(at(scotland, 0).tax).not.toBe(at(ruk, 0).tax);
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

  it("subtracts feePct from the asset's effective return", () => {
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
            feePct: 2,
            drawdownPriority: 1,
          },
        ],
      }),
    );
    // 10% return − 2% fee = 8% growth on 10000 ⇒ 10800
    expect(wrapperTotal(at(p, 0), "GIA")).toBeCloseTo(10800, 0);
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

describe("contribution funding (no leak)", () => {
  it("does not fund a contribution by liquidating a taxable pot", () => {
    const p = project(
      base({
        planToAge: 40,
        assets: [
          {
            id: "sipp",
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 0,
            monthlyContribution: 833.33,
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
            monthlyContribution: 666.67,
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

  describe("linked repayment expenses + liability startAge", () => {
    const makeInput = (): PlanInput => ({
      currentAge: 40,
      startYear: 2026,
      retirementAge: 65,
      planToAge: 45,
      inflationPct: 0,
      defaultReturnPct: 0,
      taxRegime: "RUK",
      thresholdsInflationLinked: true,
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 1000000,
          drawdownPriority: 0,
        },
      ],
      liabilities: [
        {
          id: "m1",
          label: "Mortgage",
          openingBalance: 100000,
          interestPct: 0,
          monthlyRepayment: 0,
        },
      ],
      incomes: [],
      expenses: [
        {
          id: "rep1",
          label: "Mortgage repayment",
          annualAmount: 12000,
          inflationLinked: false,
          liabilityId: "m1",
        },
      ],
      events: [],
    });

    it("excludes linked expenses from category totals", () => {
      const { years } = project(makeInput());
      expect(years[0]?.totalExpenses).toBe(0);
      expect(years[0]?.expensesByCategory).toEqual({});
    });

    it("pays the liability down from the linked expense via liabilityRepayments", () => {
      const { years } = project(makeInput());
      expect(years[0]?.liabilityRepayments).toBe(12000);
      expect(years[0]?.liabilities[0]?.value).toBe(88000);
    });

    it("reports the interest/principal split on each liability balance", () => {
      const p = project(makeInput());
      const y0 = at(p, 0);
      const l = y0.liabilities[0];
      if (!l) throw new Error("fixture");
      expect((l.interest ?? 0) + (l.principal ?? 0)).toBeCloseTo(
        y0.liabilityRepayments,
      );
    });

    it("stops the outflow once the debt is repaid", () => {
      const input = makeInput();
      input.liabilities = [
        {
          id: "m1",
          label: "Mortgage",
          openingBalance: 6000,
          interestPct: 0,
          monthlyRepayment: 0,
        },
      ];
      const { years } = project(input);
      expect(years[0]?.liabilityRepayments).toBe(6000); // capped at balance
      expect(years[1]?.liabilityRepayments).toBe(0);
    });

    it("reports zero liability value (and no repayments) before startAge", () => {
      const input = makeInput();
      input.liabilities = [
        {
          id: "m1",
          label: "Mortgage",
          openingBalance: 100000,
          interestPct: 0,
          monthlyRepayment: 0,
          startAge: 42,
        },
      ];
      const { years } = project(input);
      expect(years[0]?.liabilities[0]?.value).toBe(0); // age 40
      expect(years[0]?.liabilityRepayments).toBe(0);
      expect(years[2]?.liabilities[0]?.value).toBe(88000); // age 42: starts, pays 12k
    });

    it("treats an expense with an unknown liabilityId as a normal expense", () => {
      const input = makeInput();
      if (!input.expenses[0]) throw new Error("fixture");
      input.expenses[0] = {
        ...input.expenses[0],
        liabilityId: "no-such-liability",
        section: "FIXED",
      };
      const { years } = project(input);
      expect(years[0]?.totalExpenses).toBe(12000); // counted once, as an expense
      expect(years[0]?.expensesByCategory.FIXED).toBe(12000);
      expect(years[0]?.liabilityRepayments).toBe(0);
    });
  });
});

describe("PROPERTY_SALE event", () => {
  const saleInput = () =>
    base({
      currentAge: 40,
      planToAge: 42,
      defaultReturnPct: 0,
      inflationPct: 0,
      assets: [
        {
          id: "cash",
          label: "Cash",
          wrapper: "CASH",
          openingValue: 0,
          drawdownPriority: 0,
        },
        {
          id: "home",
          label: "Home",
          wrapper: "PROPERTY",
          openingValue: 300000,
          expectedReturnPct: 0,
          drawdownPriority: 1,
        },
      ],
      liabilities: [
        {
          id: "m",
          label: "Mortgage",
          openingBalance: 100000,
          interestPct: 0,
          monthlyRepayment: 0,
          linkedAssetId: "home",
        },
      ],
      events: [
        {
          id: "sale",
          label: "Downsize",
          age: 41,
          direction: "INFLOW",
          amount: 0,
          kind: "PROPERTY_SALE",
          assetId: "home",
        },
      ],
    });

  it("liquidates the property to cash net of the mortgage, then leaves both at zero", () => {
    const p = project(saleInput());
    expect(wrapperTotal(at(p, 0), "PROPERTY")).toBe(300000); // pre-sale
    // sale year (age 41): property gone, cash += 300000 - 100000 = 200000, mortgage cleared
    expect(wrapperTotal(at(p, 1), "PROPERTY")).toBe(0);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(200000);
    expect(at(p, 1).liabilitiesTotal).toBe(0);
    // stays sold
    expect(wrapperTotal(at(p, 2), "PROPERTY")).toBe(0);
    expect(at(p, 2).liabilitiesTotal).toBe(0);
  });

  it("does not treat the sale event's stored amount as a manual inflow", () => {
    const input = saleInput();
    if (!input.events[0]) throw new Error("fixture");
    input.events[0].amount = 999999; // ignored for PROPERTY_SALE
    const p = project(input);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(200000);
  });

  it("does not lose sale proceeds when the property is the plan's only asset", () => {
    // No CASH, no other drawable asset — the fallback synthetic cash sink
    // must catch the net proceeds instead of them being deposited back into
    // (and then zeroed with) the sold property.
    const input = base({
      currentAge: 40,
      planToAge: 42,
      defaultReturnPct: 0,
      inflationPct: 0,
      assets: [
        {
          id: "home",
          label: "Home",
          wrapper: "PROPERTY",
          openingValue: 300000,
          expectedReturnPct: 0,
          drawdownPriority: 0,
        },
      ],
      liabilities: [
        {
          id: "m",
          label: "Mortgage",
          openingBalance: 100000,
          interestPct: 0,
          monthlyRepayment: 0,
          linkedAssetId: "home",
        },
      ],
      events: [
        {
          id: "sale",
          label: "Downsize",
          age: 41,
          direction: "INFLOW",
          amount: 0,
          kind: "PROPERTY_SALE",
          assetId: "home",
        },
      ],
    });
    const p = project(input);
    expect(wrapperTotal(at(p, 1), "PROPERTY")).toBe(0);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(200000);
    expect(at(p, 1).liabilitiesTotal).toBe(0);
    expect(at(p, 1).netWorth).toBe(200000);
  });

  it("sells at the property's closing (post-growth) value, not its opening value", () => {
    // Sale in the first year of a 10%-growth property: proceeds must reflect the
    // year's growth (110000), not the opening value (100000). No mortgage; the
    // property is the only asset so the synthetic cash sink catches the proceeds.
    const p = project(
      base({
        currentAge: 40,
        planToAge: 40,
        defaultReturnPct: 0,
        inflationPct: 0,
        assets: [
          {
            id: "home",
            label: "Home",
            wrapper: "PROPERTY",
            openingValue: 100000,
            expectedReturnPct: 10,
            drawdownPriority: 0,
          },
        ],
        events: [
          {
            id: "sale",
            label: "Downsize",
            age: 40,
            direction: "INFLOW",
            amount: 0,
            kind: "PROPERTY_SALE",
            assetId: "home",
          },
        ],
      }),
    );
    expect(wrapperTotal(at(p, 0), "PROPERTY")).toBe(0);
    expect(wrapperTotal(at(p, 0), "CASH")).toBeCloseTo(110000, 0);
  });

  it("clears the mortgage from proceeds even when underwater (negative net)", () => {
    // Property 100000, mortgage 150000: net proceeds are -50000, which funds
    // like any deficit from the cash buffer; the debt still fully clears.
    const p = project(
      base({
        currentAge: 40,
        planToAge: 40,
        defaultReturnPct: 0,
        inflationPct: 0,
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 60000,
            drawdownPriority: 0,
          },
          {
            id: "home",
            label: "Home",
            wrapper: "PROPERTY",
            openingValue: 100000,
            expectedReturnPct: 0,
            drawdownPriority: 1,
          },
        ],
        liabilities: [
          {
            id: "m",
            label: "Mortgage",
            openingBalance: 150000,
            interestPct: 0,
            monthlyRepayment: 0,
            linkedAssetId: "home",
          },
        ],
        events: [
          {
            id: "sale",
            label: "Downsize",
            age: 40,
            direction: "INFLOW",
            amount: 0,
            kind: "PROPERTY_SALE",
            assetId: "home",
          },
        ],
      }),
    );
    expect(wrapperTotal(at(p, 0), "PROPERTY")).toBe(0);
    expect(at(p, 0).liabilitiesTotal).toBe(0); // debt cleared
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(10000); // 60000 - 50000 shortfall
    expect(at(p, 0).shortfall).toBe(false);
  });

  it("counts the proceeds once when two sale events target the same property", () => {
    // Second sale (age 41) hits an already-zeroed property → no-op, no double-count.
    const p = project(
      base({
        currentAge: 40,
        planToAge: 42,
        defaultReturnPct: 0,
        inflationPct: 0,
        assets: [
          {
            id: "cash",
            label: "Cash",
            wrapper: "CASH",
            openingValue: 0,
            drawdownPriority: 0,
          },
          {
            id: "home",
            label: "Home",
            wrapper: "PROPERTY",
            openingValue: 300000,
            expectedReturnPct: 0,
            drawdownPriority: 1,
          },
        ],
        events: [
          {
            id: "sale1",
            label: "Sale A",
            age: 40,
            direction: "INFLOW",
            amount: 0,
            kind: "PROPERTY_SALE",
            assetId: "home",
          },
          {
            id: "sale2",
            label: "Sale B",
            age: 41,
            direction: "INFLOW",
            amount: 0,
            kind: "PROPERTY_SALE",
            assetId: "home",
          },
        ],
      }),
    );
    expect(wrapperTotal(at(p, 0), "CASH")).toBe(300000);
    expect(wrapperTotal(at(p, 1), "CASH")).toBe(300000); // not 600000
    expect(wrapperTotal(at(p, 2), "PROPERTY")).toBe(0);
  });
});

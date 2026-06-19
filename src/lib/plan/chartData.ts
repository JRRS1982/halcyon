import { WRAPPERS, type Wrapper, type YearProjection } from "@/lib/plan";

export type NetWorthDatum = {
  age: number;
  debt: number;
  netWorth: number;
} & Partial<Record<Wrapper, number>>;

// One row per year: each wrapper's summed asset value (positive), the total
// debt as a single negative `debt` segment, and the net-worth line value.
export function toNetWorthChartData(years: YearProjection[]): NetWorthDatum[] {
  return years.map((y) => {
    const byWrapper: Partial<Record<Wrapper, number>> = {};
    for (const a of y.assets) {
      byWrapper[a.wrapper] = (byWrapper[a.wrapper] ?? 0) + a.value;
    }
    return {
      age: y.age,
      ...byWrapper,
      debt: -y.liabilitiesTotal,
      netWorth: y.netWorth,
    };
  });
}

// Which wrappers actually carry value anywhere in the series (for which <Bar>s
// to render), in canonical WRAPPERS order.
export function wrappersPresent(rows: NetWorthDatum[]): Wrapper[] {
  return WRAPPERS.filter((w) => rows.some((r) => (r[w] ?? 0) !== 0));
}

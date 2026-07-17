import {
  type ExpenseCategory,
  type IncomeKind,
  WRAPPERS,
  type Wrapper,
  type YearProjection,
} from "@/lib/plan";

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

export type NetWorthBandDatum = NetWorthDatum & { nwRange: [number, number] };

// mid pass supplies the stacked-wrapper composition + the netWorth line; low/high
// supply the [min, max] net-worth range for the shaded cone. Range is ordered so a
// crossing (rare, only with mixed-sign assets) never produces an inverted band.
export function toNetWorthBandData(
  low: YearProjection[],
  mid: YearProjection[],
  high: YearProjection[],
): NetWorthBandDatum[] {
  return toNetWorthChartData(mid).map((row, i) => {
    const lo = low[i]?.netWorth ?? row.netWorth;
    const hi = high[i]?.netWorth ?? row.netWorth;
    return { ...row, nwRange: [Math.min(lo, hi), Math.max(lo, hi)] };
  });
}

// ── Cash-flow chart ──────────────────────────────────────────────────────
// Diverging money-in / money-out. Income kinds are positive, alongside one
// positive segment per asset drawn down that year (WITHDRAW_PREFIX). Expense
// categories + TAX + REPAYMENT are negative, alongside one negative segment per
// asset paid into that year (CONTRIBUTE_PREFIX). `net` is the algebraic sum of
// the drawn segments, so the net line ties to the bars by construction. One-off
// events are not represented (the engine does not surface per-year event flows
// on YearProjection — see spec §3.1).

const INCOME_KEYS = [
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
] as const satisfies readonly IncomeKind[];

const EXPENSE_KEYS = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
] as const satisfies readonly ExpenseCategory[];

const OUTFLOW_KEYS = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
  "TAX",
  "REPAYMENT",
] as const satisfies readonly (ExpenseCategory | "TAX" | "REPAYMENT")[];

// Per-asset segment keys. Prefixed so they never collide with the fixed income
// / outflow keys above, and so the chart can tell the two flows apart.
const WITHDRAW_PREFIX = "wd:";
const CONTRIBUTE_PREFIX = "co:";

export type IncomeFlowKey = (typeof INCOME_KEYS)[number];
export type OutflowKey = (typeof OUTFLOW_KEYS)[number];

// A drawdown/contribution segment for one asset (money in for withdrawals, out
// for contributions). Carries the asset's label + wrapper for the legend colour.
export interface CashFlowSegment {
  key: string; // the datum key, e.g. "wd:<assetId>"
  assetId: string;
  label: string;
  wrapper: Wrapper;
}

// Fixed keys hold numbers; `shortfall` is boolean; per-asset segment keys are
// added dynamically. The mixed index signature keeps all three in one flat row
// (what Recharts needs), so read segment amounts through `cashFlowAmount`.
export type CashFlowDatum = {
  age: number;
  net: number;
  shortfall: boolean;
  [key: string]: number | boolean;
};

// Safely read a stacked segment's amount off a datum (0 when absent/boolean).
export function cashFlowAmount(d: CashFlowDatum, key: string): number {
  const v = d[key];
  return typeof v === "number" ? v : 0;
}

export function toCashFlowChartData(years: YearProjection[]): CashFlowDatum[] {
  return years.map((y) => {
    const row: CashFlowDatum = { age: y.age, net: 0, shortfall: y.shortfall };

    let inTotal = 0;
    for (const key of INCOME_KEYS) {
      const amount = y.incomeByKind[key] ?? 0;
      if (amount !== 0) {
        row[key] = amount;
        inTotal += amount;
      }
    }
    for (const a of y.assets) {
      if (a.withdrawn !== 0) {
        row[`${WITHDRAW_PREFIX}${a.id}`] = a.withdrawn;
        inTotal += a.withdrawn;
      }
    }

    let outTotal = 0;
    for (const key of EXPENSE_KEYS) {
      const amount = y.expensesByCategory[key] ?? 0;
      if (amount !== 0) {
        row[key] = -amount;
        outTotal += amount;
      }
    }
    const synthetic: [OutflowKey, number][] = [
      ["TAX", y.tax],
      ["REPAYMENT", y.liabilityRepayments],
    ];
    for (const [key, amount] of synthetic) {
      if (amount !== 0) {
        row[key] = -amount;
        outTotal += amount;
      }
    }
    for (const a of y.assets) {
      if (a.contributed !== 0) {
        row[`${CONTRIBUTE_PREFIX}${a.id}`] = -a.contributed;
        outTotal += a.contributed;
      }
    }

    row.net = inTotal - outTotal;
    return row;
  });
}

// Unique per-asset segments (withdrawal or contribution) occurring in any year,
// ordered by wrapper (canonical WRAPPERS order) then label so the legend is
// stable and matches the other panels' wrapper ordering.
function assetSegments(
  years: YearProjection[],
  flow: "withdrawn" | "contributed",
): CashFlowSegment[] {
  const prefix = flow === "withdrawn" ? WITHDRAW_PREFIX : CONTRIBUTE_PREFIX;
  const byId = new Map<string, CashFlowSegment>();
  for (const y of years) {
    for (const a of y.assets) {
      if (a[flow] !== 0 && !byId.has(a.id)) {
        byId.set(a.id, {
          key: `${prefix}${a.id}`,
          assetId: a.id,
          label: a.label,
          wrapper: a.wrapper,
        });
      }
    }
  }
  return [...byId.values()].sort(
    (x, z) =>
      WRAPPERS.indexOf(x.wrapper) - WRAPPERS.indexOf(z.wrapper) ||
      x.label.localeCompare(z.label),
  );
}

// Which fixed keys occur anywhere in the series (in canonical order) plus the
// per-asset withdrawal / contribution segments — so only those <Bar>s render.
export function cashFlowKeysPresent(
  rows: CashFlowDatum[],
  years: YearProjection[],
): {
  income: IncomeFlowKey[];
  outflow: OutflowKey[];
  withdrawals: CashFlowSegment[];
  contributions: CashFlowSegment[];
} {
  return {
    income: INCOME_KEYS.filter((k) =>
      rows.some((r) => cashFlowAmount(r, k) !== 0),
    ),
    outflow: OUTFLOW_KEYS.filter((k) =>
      rows.some((r) => cashFlowAmount(r, k) !== 0),
    ),
    withdrawals: assetSegments(years, "withdrawn"),
    contributions: assetSegments(years, "contributed"),
  };
}

// Group a Recharts tooltip payload into money-in / money-out rows (magnitudes),
// each side's total, and the net (in − out). The net line is skipped and zero
// entries dropped, so the tooltip lists only the segments actually drawn.
export interface CashFlowTooltipRow {
  name: string;
  value: number; // positive magnitude
  color?: string;
}
export interface CashFlowSummary {
  moneyIn: CashFlowTooltipRow[];
  moneyOut: CashFlowTooltipRow[];
  totalIn: number;
  totalOut: number;
  net: number;
}
export function summariseCashFlow(
  items: readonly {
    name?: string | number;
    value?: unknown; // Recharts payload value (number | string | …); guarded below
    dataKey?: unknown; // string | number | fn on Recharts payloads
    color?: string;
  }[],
): CashFlowSummary {
  const moneyIn: CashFlowTooltipRow[] = [];
  const moneyOut: CashFlowTooltipRow[] = [];
  for (const it of items) {
    if (it.dataKey === "net") continue;
    const value = typeof it.value === "number" ? it.value : 0;
    if (value === 0) continue;
    const row = {
      name: String(it.name ?? ""),
      value: Math.abs(value),
      color: it.color,
    };
    (value > 0 ? moneyIn : moneyOut).push(row);
  }
  const totalIn = moneyIn.reduce((s, r) => s + r.value, 0);
  const totalOut = moneyOut.reduce((s, r) => s + r.value, 0);
  return { moneyIn, moneyOut, totalIn, totalOut, net: totalIn - totalOut };
}

// Group a stacked composition tooltip (net-worth / liquid-assets) into its
// component rows and the single headline total. `totalKey` names the total
// series' dataKey (e.g. "netWorth", "total"); everything else is a component,
// signed (debt stays negative), ordered largest-first. Zero rows are dropped.
export interface StackTooltipRow {
  name: string;
  value: number; // signed
  color?: string;
}
export interface StackSummary {
  components: StackTooltipRow[];
  total: StackTooltipRow | null;
}
export function summariseStack(
  items: readonly {
    name?: string | number;
    value?: unknown;
    dataKey?: unknown;
    color?: string;
  }[],
  totalKey: string,
): StackSummary {
  const components: StackTooltipRow[] = [];
  let total: StackTooltipRow | null = null;
  for (const it of items) {
    const value = typeof it.value === "number" ? it.value : 0;
    const row = { name: String(it.name ?? ""), value, color: it.color };
    if (it.dataKey === totalKey) {
      total = row;
      continue;
    }
    if (value === 0) continue;
    components.push(row);
  }
  components.sort((a, b) => b.value - a.value);
  return { components, total };
}

// ── Liquid-assets chart ────────────────────────────────────────────────────
// Drawdownable pots only — the wrappers the engine actually draws down.
// PROPERTY (illiquid) and DB_PENSION (an income stream, not a pot) are excluded.

export const LIQUID_WRAPPERS: Wrapper[] = ["PENSION", "ISA", "GIA", "CASH"];

export type LiquidAssetsDatum = { age: number; total: number } & Partial<
  Record<Wrapper, number>
>;

export function toLiquidAssetsChartData(
  years: YearProjection[],
): LiquidAssetsDatum[] {
  return years.map((y) => {
    const row: LiquidAssetsDatum = { age: y.age, total: 0 };
    for (const a of y.assets) {
      if (!LIQUID_WRAPPERS.includes(a.wrapper)) continue;
      row[a.wrapper] = (row[a.wrapper] ?? 0) + a.value;
      row.total += a.value;
    }
    return row;
  });
}

export function liquidWrappersPresent(rows: LiquidAssetsDatum[]): Wrapper[] {
  return LIQUID_WRAPPERS.filter((w) => rows.some((r) => (r[w] ?? 0) !== 0));
}

// The age the liquid pots first hit zero after having held value — the point
// the plan is fully drawn down and reliant on income (e.g. state pension).
// Null if the pots never deplete, or there were none to begin with.
export function liquidDepletionAge(years: YearProjection[]): number | null {
  let hadLiquid = false;
  for (const y of years) {
    const liquid = y.assets
      .filter((a) => LIQUID_WRAPPERS.includes(a.wrapper))
      .reduce((sum, a) => sum + a.value, 0);
    if (liquid > 0) hadLiquid = true;
    else if (hadLiquid) return y.age;
  }
  return null;
}

export type LiquidBandDatum = LiquidAssetsDatum & {
  totalRange: [number, number];
};

export function toLiquidAssetsBandData(
  low: YearProjection[],
  mid: YearProjection[],
  high: YearProjection[],
): LiquidBandDatum[] {
  const total = (years: YearProjection[], i: number): number =>
    years[i]?.assets
      .filter((a) => LIQUID_WRAPPERS.includes(a.wrapper))
      .reduce((s, a) => s + a.value, 0) ?? 0;

  return toLiquidAssetsChartData(mid).map((row, i) => {
    const lo = total(low, i);
    const hi = total(high, i);
    return { ...row, totalRange: [Math.min(lo, hi), Math.max(lo, hi)] };
  });
}

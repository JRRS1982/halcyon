// src/app/plan/colours.ts
import type { ExpenseSection, IncomeKind, Wrapper } from "@/lib/plan";
import { theme } from "@/lib/theme";

// Reads from the palette so the set switches with the colour scheme, and so
// the values stay under the validator's eye — see the note beside
// planChartPalette in src/lib/palette.ts for what these clear and what they
// don't. DB pension and Other used to be greys, which in this app is the
// colour of "no data".
export const WRAPPER_COLOURS: Record<Wrapper, string> = {
  PENSION: theme.colors.chartPension,
  ISA: theme.colors.chartIsa,
  GIA: theme.colors.chartGia,
  CASH: theme.colors.chartCash,
  PROPERTY: theme.colors.chartProperty,
  DB_PENSION: theme.colors.chartDbPension,
  OTHER: theme.colors.chartOtherAsset,
};

// Human-readable wrapper labels for chart legends / tooltips (the raw enum keys
// read as shouty all-caps). True acronyms (ISA, GIA) stay uppercase.
export const WRAPPER_LABELS: Record<Wrapper, string> = {
  PENSION: "Pension",
  ISA: "ISA",
  GIA: "GIA",
  CASH: "Cash",
  PROPERTY: "Property",
  DB_PENSION: "DB pension",
  OTHER: "Other",
};

export const DEBT_COLOUR = theme.colors.negative;
// Was #0F1116 — a near-black line, which on a dark page is invisible.
export const NET_WORTH_COLOUR = theme.colors.ink;

// Cash-flow chart — income sources (positive) and outflows (negative).
// Drawdowns and contributions are drawn per asset (see ASSET_FLOW_PALETTE), so
// they are not keyed here.
export const INCOME_COLOURS: Record<IncomeKind, string> = {
  SALARY: theme.colors.chartIsa,
  SELF_EMPLOYMENT: theme.colors.chartOtherAsset,
  STATE_PENSION: theme.colors.chartPension,
  DB_PENSION: theme.colors.chartDbPension,
  RENTAL: theme.colors.chartCash,
  OTHER: theme.colors.chartGia,
};

// Outflows keyed by ExpenseSection + tax / loan repayments.
export const OUTFLOW_COLOURS: Record<
  ExpenseSection | "TAX" | "REPAYMENT",
  string
> = {
  FIXED: theme.colors.negative,
  VARIABLE: theme.colors.chartRate,
  DISCRETIONARY: theme.colors.chartProperty,
  TAX: theme.colors.chartBudget,
  REPAYMENT: theme.colors.chartDbPension,
};

// Per-asset drawdown / contribution segments on the cash-flow chart, assigned by
// asset order. Distinct hues, kept clear of the income greens/blues and outflow
// reds/oranges so a withdrawal isn't mistaken for salary or an expense. An
// asset's withdrawal and contribution share its colour (opposite sides of zero).
export const ASSET_FLOW_PALETTE = [
  theme.colors.chartGia,
  theme.colors.chartCash,
  theme.colors.chartOtherAsset,
  theme.colors.chartPension,
  theme.colors.chartProperty,
  theme.colors.chartIsa,
  theme.colors.chartDbPension,
  theme.colors.chartRate,
];

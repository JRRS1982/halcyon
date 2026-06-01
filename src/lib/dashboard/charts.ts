// The toggleable dashboard chart groups. Keys are stored in
// UserSettings.hiddenCharts when a user switches one off; the dashboard skips
// hidden groups and Settings renders a toggle per entry.

export const DASHBOARD_CHARTS = [
  { key: "cashFlow", label: "Income vs expenses" },
  { key: "categorySpending", label: "Spending by category" },
  { key: "balanceTrend", label: "Balance over time" },
  { key: "balanceCategory", label: "Balance by category" },
] as const;

export type DashboardChartKey = (typeof DASHBOARD_CHARTS)[number]["key"];

const KEYS: string[] = DASHBOARD_CHARTS.map((c) => c.key);

export function isDashboardChartKey(value: string): value is DashboardChartKey {
  return KEYS.includes(value);
}

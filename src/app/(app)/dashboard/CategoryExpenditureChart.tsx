"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { ChartLegend } from "@/app/(app)/dashboard/ChartLegend";
import {
  AMOUNT_AXIS_WIDTH,
  CHART_MARGIN,
  KEEP_SERIES_ORDER,
  LINE_X_PADDING,
  MONTH_INTERVAL,
} from "@/app/(app)/dashboard/chartGeometry";
import { makeAmountTick } from "@/lib/charts/format";
import { fittedAxis } from "@/lib/dashboard/axis";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

export type CategoryPoint = {
  month: string;
  actual: number;
  budget: number;
  avg: number;
};

const BUDGET_COLOR = theme.colors.chartBudget;

// A single expense category over time: solid = this month's actual, dashed grey
// = its budget, dotted = the trailing 6-month average.
export function CategoryExpenditureChart({
  data,
  color,
  currency,
  numberFormat,
}: {
  data: CategoryPoint[];
  color: string;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();

  // Shared with every other chart. Rounding to whole thousands here put the
  // same label on different gridlines — "£2k" twice in a row on the category
  // panels — which is the whole reason the shared formatter keeps a decimal.
  const tick = makeAmountTick(currency);
  const { domain, ticks } = fittedAxis(
    data.flatMap((d) => [d.actual, d.budget, d.avg]),
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="month"
          interval={MONTH_INTERVAL}
          padding={LINE_X_PADDING}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={AMOUNT_AXIS_WIDTH}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tick}
          domain={domain}
          ticks={ticks}
        />
        <Tooltip
          itemSorter={KEEP_SERIES_ORDER}
          formatter={(value, name) => [
            formatAmount(currency, Number(value), numberFormat),
            name,
          ]}
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          itemSorter={null}
          content={<ChartLegend />}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="budget"
          name="Budget"
          stroke={BUDGET_COLOR}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="avg"
          name="6-month avg"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="2 3"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// src/app/plan/LiquidAssetsChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import {
  liquidWrappersPresent,
  toLiquidAssetsChartData,
} from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { makeAmountTick } from "./chartFormat";
import { NET_WORTH_COLOUR, WRAPPER_COLOURS } from "./colours";

// Drawdownable pots stacked over time, with a total line so depletion in
// retirement is legible. Same wrapper colours as the net-worth chart.
export function LiquidAssetsChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toLiquidAssetsChartData(years);
  const wrappers = liquidWrappersPresent(data);
  const amountTick = makeAmountTick(currency);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {wrappers.map((w) => (
          <Bar
            key={w}
            dataKey={w}
            name={w}
            stackId="liquid"
            fill={WRAPPER_COLOURS[w]}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="total"
          name="Total liquid"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

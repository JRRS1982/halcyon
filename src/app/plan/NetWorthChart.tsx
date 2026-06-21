// src/app/plan/NetWorthChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import { toNetWorthChartData, wrappersPresent } from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { makeAmountTick } from "./chartFormat";
import { DEBT_COLOUR, NET_WORTH_COLOUR, WRAPPER_COLOURS } from "./colours";

export function NetWorthChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toNetWorthChartData(years);
  const wrappers = wrappersPresent(data);

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
        <ReferenceLine y={0} stroke={theme.colors.hairlineStrong} />
        {wrappers.map((w) => (
          <Bar
            key={w}
            dataKey={w}
            name={w}
            stackId="nw"
            fill={WRAPPER_COLOURS[w]}
            isAnimationActive={false}
          />
        ))}
        <Bar
          dataKey="debt"
          name="Debt"
          stackId="nw"
          fill={DEBT_COLOUR}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Net worth"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

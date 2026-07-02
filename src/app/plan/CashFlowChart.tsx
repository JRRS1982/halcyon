// src/app/plan/CashFlowChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import {
  type CashFlowDatum,
  cashFlowKeysPresent,
  toCashFlowChartData,
} from "@/lib/plan/chartData";
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
import { PLOT_LEFT_INSET, PLOT_RIGHT_INSET } from "./axisGeometry";
import { makeAmountTick } from "./chartFormat";
import { INCOME_COLOURS, NET_WORTH_COLOUR, OUTFLOW_COLOURS } from "./colours";

// Income sources + withdrawals stack above zero; expenses + tax + repayments +
// contributions stack below zero; the net line is the algebraic sum and gets a
// red dot in shortfall years.
export function CashFlowChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toCashFlowChartData(years);
  const { income, outflow } = cashFlowKeysPresent(data);
  const amountTick = makeAmountTick(currency);

  const renderNetDot = (props: {
    cx?: number;
    cy?: number;
    payload?: CashFlowDatum;
  }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload?.shortfall) {
      return <g key={`net-${payload?.age ?? cx}`} />;
    }
    return (
      <circle
        key={`net-${payload.age}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={theme.colors.negative}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={data}
        stackOffset="sign"
        barCategoryGap={1}
        margin={{ top: 16, right: PLOT_RIGHT_INSET, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={PLOT_LEFT_INSET - 8}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          formatter={(value, name) => [
            formatAmount(currency, Math.abs(Number(value)), numberFormat),
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
        {/* One stack per age: `stackOffset="sign"` sends positive income segments
            above zero and negative outflow segments below, so a single stackId
            yields one full-width bar per year with no gap between the two halves. */}
        {income.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={k}
            stackId="flow"
            fill={INCOME_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        {outflow.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={k}
            stackId="flow"
            fill={OUTFLOW_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={renderNetDot}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

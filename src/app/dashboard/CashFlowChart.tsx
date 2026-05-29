"use client";

import type { CashFlowPoint } from "@/lib/dashboard/series";
import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
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

const INCOME_COLOR = "#1F8A4C";
const EXPENSE_COLOR = "#B33B3B";
const NET_COLOR = "#1E5BC6";
const RATE_COLOR = "#D97706";
const SAVINGS_RATE_NAME = "Savings rate";

// Income vs expense bars per month, with the surplus/deficit as a line and the
// savings rate (net ÷ income) on a second % axis.
export function CashFlowChart({
  data,
  currency,
  numberFormat,
}: {
  data: CashFlowPoint[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();

  const amountTick = (v: number) => {
    const sym = symbolFor(currency);
    if (Math.abs(v) >= 1000) return `${sym}${Math.round(v / 1000)}k`;
    return `${sym}${v}`;
  };

  const fmtDelta = (d: number) => {
    const sym = symbolFor(currency);
    const abs = Math.abs(d);
    return abs >= 1000
      ? `${sym}${Math.round(abs / 1000)}k`
      : `${sym}${Math.round(abs)}`;
  };

  // Month-on-month change marker above each net point: green ▲ when the surplus
  // improved on the prior month, red ▼ when it worsened. Skips the first month
  // and unchanged months.
  const NetDeltaLabel = (props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) => {
    const { x, y, index } = props;
    if (x == null || y == null || index == null || index === 0) return <g />;
    const delta = data[index].net - data[index - 1].net;
    if (delta === 0) return <g />;
    const up = delta > 0;
    return (
      <text
        x={Number(x)}
        y={Number(y) - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={up ? INCOME_COLOR : EXPENSE_COLOR}
      >
        {up ? "▲" : "▼"} {fmtDelta(delta)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={data}
        margin={{ top: 28, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          yAxisId="amount"
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          width={48}
          tick={{ fontSize: 11, fill: theme.colors.dim }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v)}%`}
        />
        <Tooltip
          formatter={(value, name) =>
            name === SAVINGS_RATE_NAME
              ? [`${Number(value).toFixed(0)}%`, name]
              : [formatAmount(currency, Number(value), numberFormat), name]
          }
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="amount"
          dataKey="income"
          name="Income"
          fill={INCOME_COLOR}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="amount"
          dataKey="expense"
          name="Expense"
          fill={EXPENSE_COLOR}
          isAnimationActive={false}
        />
        <Line
          yAxisId="amount"
          type="monotone"
          dataKey="net"
          name="Net"
          stroke={NET_COLOR}
          strokeWidth={2}
          dot={{ r: 2.5, fill: NET_COLOR }}
          label={NetDeltaLabel}
          isAnimationActive={false}
        />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="savingsRatePct"
          name={SAVINGS_RATE_NAME}
          stroke={RATE_COLOR}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

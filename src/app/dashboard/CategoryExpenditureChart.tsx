"use client";

import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";

export type CategoryPoint = { month: string; actual: number; avg: number };

// A single expense category on its own y-scale: solid = month's actual,
// dashed = trailing 6-month average. Used for the per-category panels.
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

  const tick = (v: number) => {
    const sym = symbolFor(currency);
    if (Math.abs(v) >= 1000) return `${sym}${Math.round(v / 1000)}k`;
    return `${sym}${v}`;
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={56}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tick}
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
          dataKey="avg"
          name="6-month avg"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

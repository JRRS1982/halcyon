"use client";

import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";

export type ExpenditurePoint = { category: string; average: number };

const BAR_COLORS = ["#1E5BC6", "#1F8A4C", "#D97706"];

export function ExpenditureChart({
  data,
  currency,
  numberFormat,
}: {
  data: ExpenditurePoint[];
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
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tick}
        />
        <Tooltip
          cursor={{ fill: theme.colors.canvasSoft }}
          formatter={(value) => [
            formatAmount(currency, Number(value), numberFormat),
            "Avg actual",
          ]}
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Bar dataKey="average" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.category} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

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

export type BalancePoint = {
  month: string;
  assetCurrent: number;
  assetLongTerm: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityLongTerm: number;
  liabilityOther: number;
};

// One line per balance bucket. Assets cool, liabilities warm, so the two
// halves read apart at a glance.
const SERIES: { key: keyof BalancePoint; name: string; color: string }[] = [
  { key: "assetCurrent", name: "Current assets", color: "#1E5BC6" },
  { key: "assetLongTerm", name: "Long-term assets", color: "#1F8A4C" },
  { key: "assetOther", name: "Other assets", color: "#3BA7C4" },
  { key: "liabilityCurrent", name: "Current liabilities", color: "#B33B3B" },
  { key: "liabilityLongTerm", name: "Long-term liabilities", color: "#D97706" },
  { key: "liabilityOther", name: "Other liabilities", color: "#9A6BBA" },
];

export function BalanceTrendChart({
  data,
  currency,
  numberFormat,
}: {
  data: BalancePoint[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();

  // Compact axis ticks — full precision lives in the tooltip.
  const tick = (v: number) => {
    const sym = symbolFor(currency);
    if (Math.abs(v) >= 1000) return `${sym}${Math.round(v / 1000)}k`;
    return `${sym}${v}`;
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="month"
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
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

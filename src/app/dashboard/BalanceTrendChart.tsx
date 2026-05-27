"use client";

import type { BalancePoint } from "@/lib/dashboard/series";
import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";

export type { BalancePoint };

// Assets are shades of green, liabilities shades of red (and plotted below
// zero, since they're debt). The solid black line on top is the net balance.
const ASSET_SERIES: { key: keyof BalancePoint; name: string; color: string }[] =
  [
    { key: "assetCurrent", name: "Current assets", color: "#1F8A4C" },
    { key: "assetLongTerm", name: "Long-term assets", color: "#37A968" },
    { key: "assetOther", name: "Other assets", color: "#86C9A3" },
  ];

const LIABILITY_SERIES: {
  key: keyof BalancePoint;
  name: string;
  color: string;
}[] = [
  { key: "liabilityCurrent", name: "Current liabilities", color: "#B33B3B" },
  { key: "liabilityLongTerm", name: "Long-term liabilities", color: "#CE6464" },
  { key: "liabilityOther", name: "Other liabilities", color: "#E49B9B" },
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
        {/* Zero baseline separates assets (above) from debts (below). */}
        <ReferenceLine y={0} stroke={theme.colors.body} strokeWidth={1} />
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
        {[...ASSET_SERIES, ...LIABILITY_SERIES].map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="net"
          name="Net balance"
          stroke={theme.colors.body}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

"use client";

import type { BalancePoint } from "@/lib/dashboard/series";
import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import {
  CartesianGrid,
  Legend,
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

// Colour says which side (green = assets, red = liabilities, plotted below
// zero as debt); the dash pattern says which category. PROPERTY is asset-only.
// The solid black line on top is the net balance.
const ASSET_COLOR = "#1F8A4C";
const LIABILITY_COLOR = "#B33B3B";
const CURRENT_DASH = "8 4";
const MEDIUM_TERM_DASH = "4 2";
const LONG_TERM_DASH = "2 3";
const PROPERTY_DASH = "12 4";
const OTHER_DASH = "10 4 2 4";

const SERIES: {
  key: keyof BalancePoint;
  name: string;
  color: string;
  dash: string;
}[] = [
  {
    key: "assetCurrent",
    name: "Current assets",
    color: ASSET_COLOR,
    dash: CURRENT_DASH,
  },
  {
    key: "assetMediumTerm",
    name: "Medium-term assets",
    color: ASSET_COLOR,
    dash: MEDIUM_TERM_DASH,
  },
  {
    key: "assetLongTerm",
    name: "Long-term assets",
    color: ASSET_COLOR,
    dash: LONG_TERM_DASH,
  },
  {
    key: "assetProperty",
    name: "Property",
    color: ASSET_COLOR,
    dash: PROPERTY_DASH,
  },
  {
    key: "assetOther",
    name: "Other assets",
    color: ASSET_COLOR,
    dash: OTHER_DASH,
  },
  {
    key: "liabilityCurrent",
    name: "Current liabilities",
    color: LIABILITY_COLOR,
    dash: CURRENT_DASH,
  },
  {
    key: "liabilityMediumTerm",
    name: "Medium-term liabilities",
    color: LIABILITY_COLOR,
    dash: MEDIUM_TERM_DASH,
  },
  {
    key: "liabilityLongTerm",
    name: "Long-term liabilities",
    color: LIABILITY_COLOR,
    dash: LONG_TERM_DASH,
  },
  {
    key: "liabilityOther",
    name: "Other liabilities",
    color: LIABILITY_COLOR,
    dash: OTHER_DASH,
  },
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
        {/* Ordered assets → liabilities → net, read top to bottom. */}
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 12 }}
        />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.5}
            strokeDasharray={s.dash}
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

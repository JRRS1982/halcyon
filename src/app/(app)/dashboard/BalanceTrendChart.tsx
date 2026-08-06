"use client";

import { ChartLegend } from "@/app/(app)/dashboard/ChartLegend";
import { makeAmountTick } from "@/lib/charts/format";
import type { BalancePoint } from "@/lib/dashboard/series";
import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import { theme } from "@/lib/theme";
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
// Same greens and reds as the amount cells — these are the sign colours,
// not a separate chart palette, so they come from the token rather than
// being restated and drifting when it changes.
const ASSET_COLOR = theme.colors.positive;
const LIABILITY_COLOR = theme.colors.negative;
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
  // Shared with every other chart. Rounding to whole thousands here put the
  // same label on different gridlines — "£2k" twice in a row on the category
  // panels — which is the whole reason the shared formatter keeps a decimal.
  const tick = makeAmountTick(currency);

  // Same rounding trap as the axis: every month's net landed on "£1k", so a
  // row of point labels said nothing at all.
  const fmtNet = makeAmountTick(currency);

  // Net balance marker above each net point: green when net worth is positive,
  // red when liabilities outweigh assets. The exact value stays in the tooltip.
  const NetLabel = (props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) => {
    const { x, y, index } = props;
    if (x == null || y == null || index == null) return <g />;
    const point = data[index];
    if (!point) return <g />;
    const net = point.net;
    const up = net >= 0;
    const text = fmtNet(net);
    const cx = Number(x);
    const cy = Number(y) - 10;
    const w = text.length * 6.6 + 10;
    // Chip background so the marker stays legible over the lines behind it.
    return (
      <g>
        <rect
          x={cx - w / 2}
          y={cy - 11}
          width={w}
          height={15}
          rx={3}
          fill={theme.colors.canvas}
          stroke={up ? ASSET_COLOR : LIABILITY_COLOR}
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={up ? ASSET_COLOR : LIABILITY_COLOR}
        >
          {text}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
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
          content={<ChartLegend />}
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
          dot={{ r: 2.5, fill: theme.colors.body }}
          label={NetLabel}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

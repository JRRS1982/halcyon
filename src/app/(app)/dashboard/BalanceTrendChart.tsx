"use client";

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
import {
  AMOUNT_AXIS_WIDTH,
  LABELLED_CHART_MARGIN,
  LINE_X_PADDING,
  MONTH_INTERVAL,
} from "@/app/(app)/dashboard/chartGeometry";
import { amountAxis, makeAmountTick, niceStep } from "@/lib/charts/format";
import type { BalancePoint } from "@/lib/dashboard/series";
import { formatAmount, type NumberFormat } from "@/lib/settings/currency";
import { theme } from "@/lib/theme";

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

// Used by itemSorter to display tooltip rows in the declared series sequence
// (assets → liabilities → net) rather than Recharts' default alphabetical sort.
const SERIES_SORT_ORDER = new Map<string, number>([
  ...SERIES.map((s, i) => [s.name, i] as const),
  ["Net", SERIES.length],
]);

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

  // Net balance marker above the latest net point: green when net worth is positive,
  // red when liabilities outweigh assets. The exact value stays in the tooltip.
  const NetLabel = (props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) => {
    const { x, y, index } = props;
    // Only the latest month is labelled: a chip on every point collided at
    // the top and ran off the right edge. Earlier months live in the tooltip.
    if (x == null || y == null || index !== data.length - 1) return <g />;
    const point = data[index];
    if (!point) return <g />;
    const net = point.net;
    const up = net >= 0;
    const text = fmtNet(net);
    const w = text.length * 6.6 + 10;
    // Right-aligned to the point so the last chip stays inside the plot.
    const cx = Number(x) - w / 2 + 4;
    const cy = Number(y) - 10;
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

  // A category the user has never had (no medium-term debt, say) drew a flat
  // dashed line along zero, nine of them stacked into a smear on the baseline.
  const series = SERIES.filter((s) => data.some((d) => d[s.key] !== 0));

  // The axis spans this user's own lowest and highest figures, on round
  // gridlines, rather than Recharts' default range with room to spare.
  const extent = data.flatMap((d) => [
    d.net,
    ...series.map((s) => Number(d[s.key])),
  ]);
  const { domain, ticks } = amountAxis(
    Math.min(...extent),
    Math.max(...extent),
    niceStep(Math.min(...extent), Math.max(...extent)),
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={LABELLED_CHART_MARGIN}>
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="month"
          interval={MONTH_INTERVAL}
          padding={LINE_X_PADDING}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={AMOUNT_AXIS_WIDTH}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tick}
          domain={domain}
          ticks={ticks}
        />
        {/* Zero baseline separates assets (above) from debts (below). */}
        <ReferenceLine y={0} stroke={theme.colors.body} strokeWidth={1} />
        <Tooltip
          itemSorter={(item) =>
            SERIES_SORT_ORDER.get(item.name as string) ?? SERIES.length + 1
          }
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
        {series.map((s) => (
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
          name="Net"
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

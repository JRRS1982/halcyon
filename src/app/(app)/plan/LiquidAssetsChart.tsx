// src/app/plan/LiquidAssetsChart.tsx
"use client";

import {
  Area,
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
import { amountAxis, makeAmountTick } from "@/lib/charts/format";
import type { YearProjection } from "@/lib/plan";
import {
  liquidDepletionAge,
  liquidWrappersPresent,
  toLiquidAssetsBandData,
} from "@/lib/plan/chartData";
import type { NumberFormat } from "@/lib/settings/currency";
import { PLOT_HEIGHT, PLOT_RIGHT_INSET } from "./axisGeometry";
import { ChartTextures, wrapperFill } from "./ChartTextures";
import { ageReferenceLines } from "./chartRefLines";
import { StackedTooltip } from "./chartTooltip";
import { NET_WORTH_COLOUR, WRAPPER_COLOURS, WRAPPER_LABELS } from "./colours";
import { usePlotLeftInset } from "./usePlotLeftInset";

// Drawdownable pots stacked over time, with a total line so depletion in
// retirement is legible. Same wrapper colours as the net-worth chart.
export function LiquidAssetsChart({
  low,
  mid,
  high,
  currency,
  numberFormat,
  retirementAge,
  statePensionAge,
  expectedDeathAge,
}: {
  low: YearProjection[];
  mid: YearProjection[];
  high: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
  retirementAge: number;
  statePensionAge: number | null;
  expectedDeathAge: number | null;
}) {
  const plotLeftInset = usePlotLeftInset();
  const theme = useTheme();
  const data = toLiquidAssetsBandData(low, mid, high);
  const wrappers = liquidWrappersPresent(data);
  const minAge = data[0]?.age ?? Number.NaN;
  const maxAge = data[data.length - 1]?.age ?? Number.NaN;

  // Fixed 250k gridlines. Liquid pots never go negative, so the extent is the
  // stacked total and the low/high band; amountAxis anchors the floor at 0.
  const extent = data.flatMap((d) => [
    d.total,
    d.totalRange[0],
    d.totalRange[1],
  ]);
  const { domain, ticks } = amountAxis(
    Math.min(...extent),
    Math.max(...extent),
    250_000,
  );
  const amountTick = makeAmountTick(currency);

  return (
    <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: PLOT_RIGHT_INSET, bottom: 0, left: 8 }}
      >
        <ChartTextures />
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={plotLeftInset - 8}
          domain={domain}
          ticks={ticks}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <StackedTooltip
              active={active}
              payload={payload}
              label={label}
              currency={currency}
              numberFormat={numberFormat}
              totalKey="total"
            />
          )}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="totalRange"
          name="Return range"
          fill={NET_WORTH_COLOUR}
          fillOpacity={0.08}
          stroke="none"
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        {wrappers.map((w) => (
          <Area
            key={w}
            type="monotone"
            dataKey={w}
            name={WRAPPER_LABELS[w]}
            stackId="liquid"
            {...wrapperFill(w)}
            stroke={WRAPPER_COLOURS[w]}
            strokeWidth={1}
            strokeOpacity={0.55}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="total"
          name="Total liquid"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {ageReferenceLines({
          retirementAge,
          statePensionAge,
          expectedDeathAge,
          liquidDepletionAge: liquidDepletionAge(mid),
          minAge,
          maxAge,
          theme,
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

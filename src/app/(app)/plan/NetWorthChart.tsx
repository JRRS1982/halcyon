// src/app/plan/NetWorthChart.tsx
"use client";

import { amountAxis, makeAmountTick } from "@/lib/charts/format";
import type { YearProjection } from "@/lib/plan";
import {
  liquidDepletionAge,
  toNetWorthBandData,
  wrappersPresent,
} from "@/lib/plan/chartData";
import type { NumberFormat } from "@/lib/settings/currency";
import {
  Area,
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
import { ChartTextures, wrapperFill } from "./ChartTextures";
import { PLOT_HEIGHT, PLOT_RIGHT_INSET } from "./axisGeometry";
import { ageReferenceLines } from "./chartRefLines";
import { StackedTooltip } from "./chartTooltip";
import {
  DEBT_COLOUR,
  NET_WORTH_COLOUR,
  WRAPPER_COLOURS,
  WRAPPER_LABELS,
} from "./colours";
import { usePlotLeftInset } from "./usePlotLeftInset";

export function NetWorthChart({
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
  const data = toNetWorthBandData(low, mid, high);
  const wrappers = wrappersPresent(data);
  const minAge = data[0]?.age ?? Number.NaN;
  const maxAge = data[data.length - 1]?.age ?? Number.NaN;

  // Fixed 250k gridlines. Extent = stacked-wrapper top, debt floor, the netWorth
  // line and the low/high band, rounded outward to the nearest step.
  const extent = data.flatMap((d) => [
    d.netWorth,
    d.debt,
    d.nwRange[0],
    d.nwRange[1],
    wrappers.reduce((sum, w) => sum + (d[w] ?? 0), 0),
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
              totalKey="netWorth"
            />
          )}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke={theme.colors.hairlineStrong} />
        <Area
          type="monotone"
          dataKey="nwRange"
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
            stackId="nw"
            {...wrapperFill(w)}
            stroke={WRAPPER_COLOURS[w]}
            strokeWidth={1}
            strokeOpacity={0.55}
            isAnimationActive={false}
          />
        ))}
        <Area
          type="monotone"
          dataKey="debt"
          name="Debt"
          stackId="nw"
          fill={DEBT_COLOUR}
          fillOpacity={0.18}
          stroke={DEBT_COLOUR}
          strokeWidth={1}
          strokeOpacity={0.55}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Net worth"
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

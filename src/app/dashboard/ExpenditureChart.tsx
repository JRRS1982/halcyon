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

export type ExpenditurePoint = {
  month: string;
  fixedActual: number;
  fixedAvg: number;
  variableActual: number;
  variableAvg: number;
  discretionaryActual: number;
  discretionaryAvg: number;
};

// Per category: a solid line for the month's actual and a dashed line for the
// trailing 6-month average, in the same colour so the pair reads together.
const SERIES: {
  key: keyof ExpenditurePoint;
  name: string;
  color: string;
  dash: boolean;
}[] = [
  { key: "fixedActual", name: "Fixed", color: "#1F8A4C", dash: false },
  { key: "fixedAvg", name: "Fixed avg", color: "#1F8A4C", dash: true },
  { key: "variableActual", name: "Variable", color: "#1E5BC6", dash: false },
  { key: "variableAvg", name: "Variable avg", color: "#1E5BC6", dash: true },
  {
    key: "discretionaryActual",
    name: "Discretionary",
    color: "#D97706",
    dash: false,
  },
  {
    key: "discretionaryAvg",
    name: "Discretionary avg",
    color: "#D97706",
    dash: true,
  },
];

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
            strokeDasharray={s.dash ? "4 4" : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

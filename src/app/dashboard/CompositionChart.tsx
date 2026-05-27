"use client";

import type { CompositionSlice } from "@/lib/dashboard/series";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTheme } from "styled-components";

// Same colours the rest of the dashboard uses for each expense category.
const SLICE_COLORS: Record<string, string> = {
  Fixed: "#1F8A4C",
  Variable: "#1E5BC6",
  Discretionary: "#D97706",
};

const FALLBACK_COLOR = "#9CA3AF";

// Where the latest month's money went, as a donut across expense categories.
export function CompositionChart({
  data,
  currency,
  numberFormat,
}: {
  data: CompositionSlice[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={64}
          outerRadius={100}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((slice) => (
            <Cell
              key={slice.name}
              fill={SLICE_COLORS[slice.name] ?? FALLBACK_COLOR}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

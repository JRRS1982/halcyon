"use client";

import type { BudgetActualPoint } from "@/lib/dashboard/series";
import {
  type NumberFormat,
  formatAmount,
  symbolFor,
} from "@/lib/settings/currency";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styled, { useTheme } from "styled-components";

const BUDGET_COLOR = "#9CA3AF";
const ACTUAL_COLOR = "#1E5BC6";

export type CategoryBudgetActual = {
  category: string;
  budget: number;
  actual: number;
};

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const SubCap = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;

// Budget vs actual two ways: grouped bars per category for the latest month
// (am I on track now?), and a budget/actual trend over the last few months
// (am I drifting over time?).
export function BudgetVsActualChart({
  categories,
  trend,
  currency,
  numberFormat,
}: {
  categories: CategoryBudgetActual[];
  trend: BudgetActualPoint[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();

  const tick = (v: number) => {
    const sym = symbolFor(currency);
    if (Math.abs(v) >= 1000) return `${sym}${Math.round(v / 1000)}k`;
    return `${sym}${v}`;
  };

  const tooltip = (
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
  );

  return (
    <Stack>
      <div>
        <SubCap>Latest month by category</SubCap>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={categories}
            margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
          >
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
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="budget"
              name="Budget"
              fill={BUDGET_COLOR}
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              name="Actual"
              fill={ACTUAL_COLOR}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <SubCap>Total expenses — last 6 months</SubCap>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={trend}
            margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
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
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke={BUDGET_COLOR}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Stack>
  );
}

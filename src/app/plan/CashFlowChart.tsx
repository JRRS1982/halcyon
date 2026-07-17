// src/app/plan/CashFlowChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import {
  type CashFlowDatum,
  type CashFlowTooltipRow,
  type IncomeFlowKey,
  type OutflowKey,
  cashFlowAmount,
  cashFlowKeysPresent,
  summariseCashFlow,
  toCashFlowChartData,
} from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Bar,
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
import styled, { useTheme } from "styled-components";
import { PLOT_LEFT_INSET, PLOT_RIGHT_INSET } from "./axisGeometry";
import { amountAxis, makeAmountTick } from "./chartFormat";
import { ageReferenceLines } from "./chartRefLines";
import {
  Key,
  TipAge,
  TipBox,
  TipHeading,
  TipLabel,
  TipName,
  TipRow,
  TipTotal,
  TipValue,
} from "./chartTooltip";
import {
  ASSET_FLOW_PALETTE,
  INCOME_COLOURS,
  NET_WORTH_COLOUR,
  OUTFLOW_COLOURS,
} from "./colours";

const TipNet = styled(TipRow)<{ $negative: boolean }>`
  font-weight: 600;
  border-top: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.xs};
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.negative : theme.colors.positive};
  font-variant-numeric: tabular-nums;
`;

// Custom cash-flow tooltip: money-in and money-out grouped with a subtotal each,
// then the net at the bottom — so the total inflow / outflow and the balance are
// legible, which the flat default (one row per segment) didn't make clear.
function CashFlowTooltip({
  active,
  payload,
  label,
  currency,
  numberFormat,
}: {
  active?: boolean;
  payload?: readonly {
    name?: string | number;
    value?: unknown;
    dataKey?: unknown;
    color?: string;
  }[];
  label?: string | number;
  currency: string;
  numberFormat: NumberFormat;
}) {
  if (!active || !payload?.length) return null;
  const { moneyIn, moneyOut, totalIn, totalOut, net } =
    summariseCashFlow(payload);
  const fmt = (n: number) => formatAmount(currency, n, numberFormat);
  const row = (r: CashFlowTooltipRow) => (
    <TipRow key={r.name}>
      <TipLabel>
        {r.color ? <Key $c={r.color} /> : null}
        <TipName>{r.name}</TipName>
      </TipLabel>
      <TipValue>{fmt(r.value)}</TipValue>
    </TipRow>
  );

  return (
    <TipBox>
      <TipAge>Age {label}</TipAge>
      {moneyIn.length > 0 ? (
        <>
          <TipHeading>Money in</TipHeading>
          {moneyIn.map(row)}
          <TipTotal>
            <TipName>Total in</TipName>
            <TipValue>{fmt(totalIn)}</TipValue>
          </TipTotal>
        </>
      ) : null}
      {moneyOut.length > 0 ? (
        <>
          <TipHeading>Money out</TipHeading>
          {moneyOut.map(row)}
          <TipTotal>
            <TipName>Total out</TipName>
            <TipValue>{fmt(totalOut)}</TipValue>
          </TipTotal>
        </>
      ) : null}
      <TipNet $negative={net < 0}>
        <TipName>Net</TipName>
        <span>
          {net < 0 ? "−" : "+"}
          {fmt(Math.abs(net))}
        </span>
      </TipNet>
    </TipBox>
  );
}

// Human-readable legend / tooltip labels for the fixed income and outflow keys
// (the raw enum keys read as shouty all-caps). Per-asset segments already carry
// the asset's own label ("Withdraw SIPP").
const FLOW_LABELS: Record<IncomeFlowKey | OutflowKey, string> = {
  SALARY: "Salary",
  SELF_EMPLOYMENT: "Self-employment",
  STATE_PENSION: "State pension",
  DB_PENSION: "DB pension",
  RENTAL: "Rental",
  OTHER: "Other",
  FIXED: "Fixed",
  VARIABLE: "Variable",
  DISCRETIONARY: "Discretionary",
  TAX: "Tax",
  REPAYMENT: "Loan repayments",
};

// Income sources + per-asset withdrawals stack above zero; expenses + tax +
// repayments + per-asset contributions stack below zero; the net line is the
// algebraic sum and gets a red dot in shortfall years.
export function CashFlowChart({
  years,
  currency,
  numberFormat,
  retirementAge,
  statePensionAge,
  expectedDeathAge,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
  retirementAge: number;
  statePensionAge: number | null;
  expectedDeathAge: number | null;
}) {
  const theme = useTheme();
  const data = toCashFlowChartData(years);
  const { income, outflow, withdrawals, contributions } = cashFlowKeysPresent(
    data,
    years,
  );
  const minAge = data[0]?.age ?? Number.NaN;
  const maxAge = data[data.length - 1]?.age ?? Number.NaN;

  // Each asset keeps one colour across both its withdrawal (money-in) and its
  // contribution (money-out) segments, assigned by first appearance.
  const assetIds = [
    ...new Set([...withdrawals, ...contributions].map((s) => s.assetId)),
  ];
  const assetColour = (assetId: string): string =>
    ASSET_FLOW_PALETTE[assetIds.indexOf(assetId) % ASSET_FLOW_PALETTE.length] ??
    theme.colors.dim;

  // Fixed 10k gridlines. Extent = the positive stack top (income + withdrawals),
  // the negative stack bottom (outflows + contributions, stored negative) and
  // the net line.
  const posKeys = [...income, ...withdrawals.map((s) => s.key)];
  const negKeys = [...outflow, ...contributions.map((s) => s.key)];
  const extent = data.flatMap((d) => [
    posKeys.reduce((sum, k) => sum + cashFlowAmount(d, k), 0),
    negKeys.reduce((sum, k) => sum + cashFlowAmount(d, k), 0),
    d.net,
  ]);
  const { domain, ticks } = amountAxis(
    Math.min(...extent),
    Math.max(...extent),
    10_000,
  );
  const amountTick = makeAmountTick(currency);

  const renderNetDot = (props: {
    cx?: number;
    cy?: number;
    payload?: CashFlowDatum;
  }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload?.shortfall) {
      return <g key={`net-${payload?.age ?? cx}`} />;
    }
    return (
      <circle
        key={`net-${payload.age}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={theme.colors.negative}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={data}
        stackOffset="sign"
        barCategoryGap={1}
        margin={{ top: 16, right: PLOT_RIGHT_INSET, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={PLOT_LEFT_INSET - 8}
          domain={domain}
          ticks={ticks}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <CashFlowTooltip
              active={active}
              payload={payload}
              label={label}
              currency={currency}
              numberFormat={numberFormat}
            />
          )}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke={theme.colors.hairlineStrong} />
        {/* One stack per age: `stackOffset="sign"` sends positive income segments
            above zero and negative outflow segments below, so a single stackId
            yields one full-width bar per year with no gap between the two halves. */}
        {income.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={FLOW_LABELS[k]}
            stackId="flow"
            fill={INCOME_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        {withdrawals.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={`Withdraw ${s.label}`}
            stackId="flow"
            fill={assetColour(s.assetId)}
            isAnimationActive={false}
          />
        ))}
        {outflow.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={FLOW_LABELS[k]}
            stackId="flow"
            fill={OUTFLOW_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        {contributions.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={`Contribute ${s.label}`}
            stackId="flow"
            fill={assetColour(s.assetId)}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={renderNetDot}
          isAnimationActive={false}
        />
        {ageReferenceLines({
          retirementAge,
          statePensionAge,
          expectedDeathAge,
          minAge,
          maxAge,
          theme,
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

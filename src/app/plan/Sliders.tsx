// src/app/plan/Sliders.tsx
"use client";

import styled from "styled-components";
import { PlanCard } from "./PlanCard";
import type { AssumptionOverrides } from "./liveBand";
import type { SerializedPlanAssumptions } from "./serialized";

type Lever = {
  key: keyof AssumptionOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const LEVERS: Lever[] = [
  {
    key: "retirementAge",
    label: "Retirement age",
    min: 40,
    max: 90,
    step: 1,
    suffix: "",
  },
  {
    key: "defaultReturnPct",
    label: "Return",
    min: -5,
    max: 15,
    step: 0.1,
    suffix: "%",
  },
  {
    key: "returnSpreadPct",
    label: "Return spread ±",
    min: 0,
    max: 10,
    step: 0.1,
    suffix: "%",
  },
  {
    key: "inflationPct",
    label: "Inflation",
    min: 0,
    max: 10,
    step: 0.1,
    suffix: "%",
  },
];

const Row = styled.label`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;
const Head = styled.div`
  display: flex;
  justify-content: space-between;
  grid-column: 1 / -1;
`;
const Value = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.ink};
  font-weight: 500;
`;
const Range = styled.input`
  grid-column: 1 / -1;
  width: 100%;
`;
const Hint = styled.p`
  grid-column: 1 / -1;
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;

export function Sliders({
  assumptions,
  onInput,
  onCommit,
}: {
  assumptions: SerializedPlanAssumptions;
  onInput: (key: keyof AssumptionOverrides, value: number) => void;
  onCommit: (key: keyof AssumptionOverrides, value: number) => void;
}) {
  return (
    <PlanCard aria-label="Quick adjustments">
      <Hint>Drag to explore — changes save when you release.</Hint>
      {LEVERS.map((l) => {
        const value = assumptions[l.key];
        return (
          <Row key={l.key}>
            <Head>
              <span>{l.label}</span>
              <Value>
                {value}
                {l.suffix}
              </Value>
            </Head>
            <Range
              type="range"
              min={l.min}
              max={l.max}
              step={l.step}
              value={value}
              aria-label={l.label}
              onChange={(e) => onInput(l.key, Number(e.target.value))}
              onPointerUp={(e) =>
                onCommit(l.key, Number(e.currentTarget.value))
              }
              onKeyUp={(e) => onCommit(l.key, Number(e.currentTarget.value))}
            />
          </Row>
        );
      })}
    </PlanCard>
  );
}

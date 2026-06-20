// src/app/plan/AssumptionsPanel.tsx
"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import { updatePlanAssumptions } from "./actions";
import type { SerializedPlanAssumptions } from "./serialized";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;
const Input = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

export function AssumptionsPanel({
  assumptions,
}: { assumptions: SerializedPlanAssumptions }) {
  const [a, setA] = useState(assumptions);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (next: SerializedPlanAssumptions) => {
    startTransition(async () => {
      try {
        setError(null);
        await updatePlanAssumptions({
          planId: next.id,
          dateOfBirth: next.dateOfBirth,
          retirementAge: next.retirementAge,
          planToAge: next.planToAge,
          inflationPct: next.inflationPct,
          defaultReturnPct: next.defaultReturnPct,
          blendedTaxRatePct: next.blendedTaxRatePct,
          statePensionAge: next.statePensionAge,
          statePensionAnnual: next.statePensionAnnual,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  const num = (v: string): number => (v === "" ? 0 : Number(v));
  const nullableNum = (v: string): number | null =>
    v === "" ? null : Number(v);

  return (
    <Panel aria-busy={pending}>
      <Heading>Assumptions</Heading>
      <Grid>
        <Field>
          Date of birth
          <Input
            type="date"
            defaultValue={a.dateOfBirth}
            onBlur={(e) => {
              const next = { ...a, dateOfBirth: e.target.value };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          Retirement age
          <Input
            type="number"
            defaultValue={a.retirementAge}
            onBlur={(e) => {
              const next = { ...a, retirementAge: num(e.target.value) };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          Plan to age
          <Input
            type="number"
            defaultValue={a.planToAge}
            onBlur={(e) => {
              const next = { ...a, planToAge: num(e.target.value) };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          Inflation %
          <Input
            type="number"
            step="0.1"
            defaultValue={a.inflationPct}
            onBlur={(e) => {
              const next = { ...a, inflationPct: num(e.target.value) };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          Default return %
          <Input
            type="number"
            step="0.1"
            defaultValue={a.defaultReturnPct}
            onBlur={(e) => {
              const next = { ...a, defaultReturnPct: num(e.target.value) };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          Tax rate %
          <Input
            type="number"
            step="0.1"
            defaultValue={a.blendedTaxRatePct}
            onBlur={(e) => {
              const next = { ...a, blendedTaxRatePct: num(e.target.value) };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          State pension age
          <Input
            type="number"
            defaultValue={a.statePensionAge ?? ""}
            onBlur={(e) => {
              const next = {
                ...a,
                statePensionAge: nullableNum(e.target.value),
              };
              setA(next);
              save(next);
            }}
          />
        </Field>
        <Field>
          State pension / yr
          <Input
            type="number"
            defaultValue={a.statePensionAnnual ?? ""}
            onBlur={(e) => {
              const next = {
                ...a,
                statePensionAnnual: nullableNum(e.target.value),
              };
              setA(next);
              save(next);
            }}
          />
        </Field>
      </Grid>
      {error ? <Err>{error}</Err> : null}
    </Panel>
  );
}

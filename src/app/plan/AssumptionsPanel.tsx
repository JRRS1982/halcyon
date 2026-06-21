// src/app/plan/AssumptionsPanel.tsx
"use client";

import { useState } from "react";
import styled from "styled-components";
import { NumberCell, TextCell } from "./EditableCell";
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
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

export function AssumptionsPanel({
  assumptions,
}: { assumptions: SerializedPlanAssumptions }) {
  const [error, setError] = useState<string | null>(null);

  // `assumptions` is the committed server value; each field sends the one value
  // it changed, spread over the latest. Rethrows so the cell reverts on fail.
  const save = async (next: SerializedPlanAssumptions) => {
    setError(null);
    try {
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
      throw e;
    }
  };

  const a = assumptions;

  return (
    <Panel>
      <Heading>Assumptions</Heading>
      <Grid>
        <Field>
          Date of birth
          <TextCell
            type="date"
            value={a.dateOfBirth}
            onCommit={(v) => save({ ...a, dateOfBirth: v })}
          />
        </Field>
        <Field>
          Retirement age
          <NumberCell
            value={a.retirementAge}
            onCommit={(v) =>
              save({ ...a, retirementAge: v ?? a.retirementAge })
            }
          />
        </Field>
        <Field>
          Plan to age
          <NumberCell
            value={a.planToAge}
            onCommit={(v) => save({ ...a, planToAge: v ?? a.planToAge })}
          />
        </Field>
        <Field>
          Inflation %
          <NumberCell
            value={a.inflationPct}
            step="0.1"
            onCommit={(v) => save({ ...a, inflationPct: v ?? a.inflationPct })}
          />
        </Field>
        <Field>
          Default return %
          <NumberCell
            value={a.defaultReturnPct}
            step="0.1"
            onCommit={(v) =>
              save({ ...a, defaultReturnPct: v ?? a.defaultReturnPct })
            }
          />
        </Field>
        <Field>
          Tax rate %
          <NumberCell
            value={a.blendedTaxRatePct}
            step="0.1"
            onCommit={(v) =>
              save({ ...a, blendedTaxRatePct: v ?? a.blendedTaxRatePct })
            }
          />
        </Field>
        <Field>
          State pension age
          <NumberCell
            value={a.statePensionAge}
            nullable
            onCommit={(v) => save({ ...a, statePensionAge: v })}
          />
        </Field>
        <Field>
          State pension / yr
          <NumberCell
            value={a.statePensionAnnual}
            nullable
            onCommit={(v) => save({ ...a, statePensionAnnual: v })}
          />
        </Field>
      </Grid>
      {error ? <Err>{error}</Err> : null}
    </Panel>
  );
}

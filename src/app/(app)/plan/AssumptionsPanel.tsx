// src/app/plan/AssumptionsPanel.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import styled from "styled-components";
import { DateOfBirthField } from "@/components/ui/DateOfBirthField";
import { InfoTip } from "@/components/ui/InfoTip";
import type { Regime } from "@/lib/tax/types";
import { updatePlanAssumptions } from "./actions";
import { BoolCell, NumberCell, SelectCell, TextCell } from "./EditableCell";
import type { SerializedPlanAssumptions } from "./serialized";

const TAX_REGIMES: Regime[] = ["RUK", "SCOTLAND"];
const TAX_REGIME_LABELS: Record<Regime, string> = {
  RUK: "Rest of UK",
  SCOTLAND: "Scotland",
};

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
// Same shape as Field, but a div — see its use below.
const FieldGroup = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;
const BoolLabel = styled.label`
  cursor: pointer;
`;
// The label and its "i" sit on one line.
const LabelRow = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;

export function AssumptionsPanel({
  assumptions,
}: {
  assumptions: SerializedPlanAssumptions;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const thresholdsId = useId();
  const regimeId = useId();

  // `assumptions` is the committed server value; each field sends the one value
  // it changed, spread over the latest. On success we refresh the route so the
  // chart + verdict re-render; rethrows so the cell reverts on failure.
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
        returnSpreadPct: next.returnSpreadPct,
        taxRegime: next.taxRegime,
        thresholdsInflationLinked: next.thresholdsInflationLinked,
        statePensionAge: next.statePensionAge,
        statePensionAnnual: next.statePensionAnnual,
        expectedDeathAge: next.expectedDeathAge,
      });
      router.refresh();
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
        {/* Three fields rather than a native date input: that renders in the
            browser's locale, so a UK user on a US-locale browser reads
            mm/dd/yyyy, and its calendar is a poor way to reach a birth year.
            An incomplete date arrives as "" and is simply not saved. */}
        <DateOfBirthField
          legend="Date of birth"
          value={a.dateOfBirth}
          onCommit={(iso) => {
            if (!iso) return;
            void save({ ...a, dateOfBirth: iso });
          }}
        />
        <Field>
          Retirement age
          <NumberCell
            value={a.retirementAge}
            min={40}
            max={90}
            onCommit={(v) =>
              save({ ...a, retirementAge: v ?? a.retirementAge })
            }
          />
        </Field>
        <Field>
          Plan to age
          <NumberCell
            value={a.planToAge}
            min={50}
            max={120}
            onCommit={(v) => save({ ...a, planToAge: v ?? a.planToAge })}
          />
        </Field>
        <Field>
          Inflation %
          <NumberCell
            value={a.inflationPct}
            step="0.1"
            min={0}
            max={20}
            onCommit={(v) => save({ ...a, inflationPct: v ?? a.inflationPct })}
          />
        </Field>
        <Field>
          Default return %
          <NumberCell
            value={a.defaultReturnPct}
            step="0.1"
            min={-20}
            max={30}
            onCommit={(v) =>
              save({ ...a, defaultReturnPct: v ?? a.defaultReturnPct })
            }
          />
        </Field>
        <Field>
          Return spread ±%
          <NumberCell
            value={a.returnSpreadPct}
            step="0.1"
            min={0}
            max={10}
            onCommit={(v) =>
              save({ ...a, returnSpreadPct: v ?? a.returnSpreadPct })
            }
          />
        </Field>
        {/* A div for the same reason as the toggle below: the "i" must not
            sit inside a label. A select is its own control, so the label
            points at it by id. */}
        <FieldGroup>
          <LabelRow>
            <BoolLabel htmlFor={regimeId}>Tax regime</BoolLabel>
            <InfoTip
              label="What is rest of UK?"
              title="Which bands your income is taxed at"
              body="Scotland sets its own income tax rates and bands; England, Wales and Northern Ireland share one set. HMRC calls that second set the rest of UK — it means the UK apart from Scotland, which is why it is not simply called UK. Pick whichever applies to where you are resident for tax."
            />
          </LabelRow>
          <SelectCell
            id={regimeId}
            value={a.taxRegime}
            options={TAX_REGIMES}
            labels={TAX_REGIME_LABELS}
            onCommit={(v) => save({ ...a, taxRegime: v })}
          />
        </FieldGroup>
        {/* A div, not the usual Field label: the "i" sits beside the label
            text, and a label that wrapped it would claim its clicks for the
            checkbox. The label points at the box by id instead. */}
        <FieldGroup>
          <LabelRow>
            <BoolLabel htmlFor={thresholdsId}>
              Tax bands rise with inflation
            </BoolLabel>
            <InfoTip
              label="What rises with inflation?"
              title="Tax bands rise with inflation"
              body="The income tax bands themselves — the personal allowance and the points where the higher and additional rates start. Published bands only exist up to the current tax year, so beyond it the projection either lifts them each year with your inflation rate, or leaves them frozen at today's figures. Frozen means more of your income crosses into higher bands every year purely because the numbers grew, which over decades swamps every other assumption in the plan."
            />
          </LabelRow>
          <BoolCell
            id={thresholdsId}
            value={a.thresholdsInflationLinked}
            onCommit={(v) => save({ ...a, thresholdsInflationLinked: v })}
          />
        </FieldGroup>
        <Field>
          State pension age
          <NumberCell
            value={a.statePensionAge}
            nullable
            min={50}
            max={80}
            onCommit={(v) => save({ ...a, statePensionAge: v })}
          />
        </Field>
        <Field>
          State pension / yr
          <NumberCell
            value={a.statePensionAnnual}
            nullable
            min={0}
            onCommit={(v) => save({ ...a, statePensionAnnual: v })}
          />
        </Field>
        <Field>
          Expected age at death
          <NumberCell
            value={a.expectedDeathAge}
            nullable
            min={1}
            max={120}
            onCommit={(v) => save({ ...a, expectedDeathAge: v })}
          />
        </Field>
      </Grid>
      {error ? <Err>{error}</Err> : null}
    </Panel>
  );
}

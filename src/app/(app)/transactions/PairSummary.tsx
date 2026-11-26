// The possible-transfers view groups the ledger by pair: a one-line summary
// ("Current → Savings · £200.00 · 1 day apart") with the pair's two rows
// bracketed beneath it as ordinary ledger rows. One tick on the summary
// selects both rows.
"use client";

import type { ReactNode } from "react";
import styled, { css } from "styled-components";
import { Checkbox } from "@/components/ui/Checkbox";

// The bracket: a rule down the left of the summary and both rows, in the
// action colour while the pair is ticked and the sign green once it is
// approved. On a phone the table is a stack of blocks, so the group itself
// carries the rule.
export const PairGroup = styled.tbody<{
  $selected: boolean;
  $approved: boolean;
}>`
  ${({ $selected, $approved, theme }) => {
    const rule = $selected
      ? theme.colors.primary
      : $approved
        ? theme.colors.positive
        : theme.colors.hairlineStrong;
    return css`
      > tr > td:first-child {
        box-shadow: inset 3px 0 0 ${rule};
      }

      @media (max-width: 767px) {
        box-shadow: inset 3px 0 0 ${rule};
        padding-left: ${theme.spacing.sm};

        > tr > td:first-child {
          box-shadow: none;
        }
      }
    `;
  }}
`;

// The whole line toggles the pair, as a ledger row toggles its own tick.
const SummaryRow = styled.tr`
  cursor: pointer;
  @media (max-width: 767px) {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.md};
  }
`;

const CheckCell = styled.td`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.xxs}`};
  vertical-align: middle;

  @media (max-width: 767px) {
    padding: 0;
  }
`;

const SummaryCell = styled.td`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.xxs}`};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};

  @media (max-width: 767px) {
    padding: 0;
  }
`;

const SummaryLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Warning = styled.span`
  padding: 1px ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
  color: ${({ theme }) => theme.colors.ink};
  font-size: 12px;
  font-weight: ${({ theme }) => theme.typography.control.weight};
`;

export function PairSummary({
  label,
  warnings,
  checked,
  onToggle,
  span,
  action,
}: {
  label: string;
  warnings: string[];
  checked: boolean;
  onToggle: () => void;
  /** Columns the summary spans after the checkbox. */
  span: number;
  /** What can be done to the whole pair from its line (Approve transfer). */
  action?: ReactNode;
}): ReactNode {
  return (
    <SummaryRow onClick={onToggle}>
      <CheckCell>
        <Checkbox
          checked={checked}
          onChange={onToggle}
          // The row's own click toggles too; without this they cancel out.
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select pair ${label}`}
        />
      </CheckCell>
      <SummaryCell colSpan={span}>
        <SummaryLine>
          <span>{label}</span>
          {warnings.map((warning) => (
            <Warning key={warning}>{warning}</Warning>
          ))}
          {action}
        </SummaryLine>
      </SummaryCell>
    </SummaryRow>
  );
}

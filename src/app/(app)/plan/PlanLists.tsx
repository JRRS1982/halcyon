// src/app/plan/PlanLists.tsx
"use client";

import { type ReactNode, useId, useState } from "react";
import styled from "styled-components";
import { PlanCard } from "./PlanCard";
import { ViewSwitch } from "./ViewSwitch";

// The rows the projection runs on (assets, liabilities, income, expenses,
// events), one list at a time behind a switch. Laid out two across, five
// lists of very different lengths left a ragged grid with a hole beside the
// last, and an "Up to date" button floating above it that never said what it
// was up to date with. The header now says where the rows come from, and the
// sync state sits at the end of that line.

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing["2xl"]};
`;

const Heading = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  line-height: ${({ theme }) => theme.typography.displayLg.lineHeight};
  color: ${({ theme }) => theme.colors.ink};
`;

const Lead = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  max-width: 60ch;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.body};
`;

export type PlanListId =
  | "assets"
  | "liabilities"
  | "income"
  | "expenses"
  | "events";

export type PlanList = {
  id: PlanListId;
  label: string;
  count: number;
  content: ReactNode;
};

export function PlanLists({
  sync,
  lists,
}: {
  /** The sync state or button, at the end of the header line. */
  sync: ReactNode;
  lists: readonly PlanList[];
}) {
  const [open, setOpen] = useState<PlanListId>("assets");
  const headingId = useId();
  const current = lists.find((list) => list.id === open) ?? lists[0];

  return (
    <PlanCard aria-labelledby={headingId}>
      <Header>
        <div>
          <Heading id={headingId}>What the plan is built from</Heading>
          <Lead>
            Your accounts and budget, copied in when you sync. Edit a row here
            to change only the plan.
          </Lead>
        </div>
        {sync}
      </Header>
      <ViewSwitch
        label="Plan list"
        options={lists}
        value={current?.id ?? open}
        onChange={setOpen}
      />
      {current?.content}
    </PlanCard>
  );
}

// src/app/plan/RecordPanel.ts
import styled from "styled-components";
import { visuallyHidden } from "@/lib/visuallyHidden";

// The chrome every record list shares (assets, liabilities, income, expenses,
// events). Each list used to carry its own identical copy of these four.
//
// The lists sit behind one tab switch (PlanLists), which names the open list
// and opens the section, so a panel needs no rule of its own and its heading
// is for assistive tech's outline only.

export const Panel = styled.section`
  padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Heading = styled.h3`
  ${visuallyHidden}
`;

export const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;

export const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;

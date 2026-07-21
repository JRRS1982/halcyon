"use client";

import type { ReactNode } from "react";
import styled from "styled-components";

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

export function MortgageBadge({ children }: { children: ReactNode }) {
  return <Pill>{children}</Pill>;
}

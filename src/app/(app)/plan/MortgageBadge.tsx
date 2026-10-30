"use client";

import type { ReactNode } from "react";
import styled from "styled-components";

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.kicker.family};
  font-size: ${({ theme }) => theme.typography.kicker.size};
  font-weight: ${({ theme }) => theme.typography.kicker.weight};
  letter-spacing: ${({ theme }) => theme.typography.kicker.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

export function MortgageBadge({ children }: { children: ReactNode }) {
  return <Pill>{children}</Pill>;
}

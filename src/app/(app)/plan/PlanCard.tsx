// src/app/plan/PlanCard.tsx
"use client";

import styled from "styled-components";

// Shared section chrome for the chart and timeline panels: a ruled section,
// like every other plan panel. Identical horizontal padding (none) on both is
// what makes PLOT_LEFT_INSET / PLOT_RIGHT_INSET line up between them.
export const PlanCard = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  padding: ${({ theme }) => theme.spacing.lg} 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

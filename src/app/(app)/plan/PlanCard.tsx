// src/app/plan/PlanCard.tsx
"use client";

import styled from "styled-components";

// Shared bordered-card chrome for the chart and timeline panels. Identical outer
// box (border + horizontal padding) on both is what makes PLOT_LEFT_INSET /
// PLOT_RIGHT_INSET line up between them. Other plan panels keep their own styling.
export const PlanCard = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

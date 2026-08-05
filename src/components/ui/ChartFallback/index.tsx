"use client";

import styled from "styled-components";

// Holds a chart's footprint while its chunk loads, so the panel doesn't
// collapse and reflow the page when recharts arrives. Deliberately plain —
// DESIGN.md keeps chart surfaces flat and hairline-bordered.
const Frame = styled.div<{ $height: number }>`
  height: ${({ $height }) => $height}px;
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvasSoft};
`;

export function ChartFallback({ height }: { height: number }) {
  return <Frame $height={height} aria-hidden="true" />;
}

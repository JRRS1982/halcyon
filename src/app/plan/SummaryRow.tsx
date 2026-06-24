// src/app/plan/SummaryRow.tsx
"use client";

import styled from "styled-components";

export const SummaryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
`;

const Row = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  background: transparent;
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  cursor: pointer;
  text-align: left;
  font: inherit;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.ink};
  &:hover { background: ${({ theme }) => theme.colors.canvasSoft}; }
  li:first-child & { border-top: 0; }
`;
const Primary = styled.span`
  font-size: 14px;
  font-weight: 500;
`;
const Secondary = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  font-variant-numeric: tabular-nums;
  text-align: right;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  &::after {
    content: "›";
    color: ${({ theme }) => theme.colors.hairlineStrong};
    font-size: 16px;
  }
`;

export function SummaryRow({
  primary,
  secondary,
  onOpen,
}: {
  primary: string;
  secondary: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <Row type="button" aria-haspopup="dialog" onClick={onOpen}>
        <Primary>{primary}</Primary>
        <Secondary>{secondary}</Secondary>
      </Row>
    </li>
  );
}

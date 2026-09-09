"use client";

import type { LegendPayload } from "recharts";
import styled from "styled-components";

// Recharts' default legend draws the same solid icon for every series,
// ignoring strokeDasharray — useless on charts where the dash pattern is the
// only thing distinguishing lines. This renders each entry's icon with its
// real colour and dash pattern. Wire in via <Legend content={<ChartLegend />}>.

const List = styled.ul<{ $vertical: boolean }>`
  display: flex;
  flex-direction: ${({ $vertical }) => ($vertical ? "column" : "row")};
  flex-wrap: wrap;
  justify-content: ${({ $vertical }) => ($vertical ? "flex-start" : "center")};
  gap: ${({ $vertical }) => ($vertical ? "4px" : "4px 16px")};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SeparatorItem = styled.li`
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  margin: 4px 0;
  list-style: none;
`;

const dashOf = (entry: LegendPayload): string | undefined => {
  const payload = entry.payload as
    | { strokeDasharray?: string | number }
    | undefined;
  if (payload?.strokeDasharray == null) return undefined;
  return String(payload.strokeDasharray);
};

export function ChartLegend({
  payload,
  layout,
  separatorAfter,
}: {
  payload?: ReadonlyArray<LegendPayload>;
  layout?: "horizontal" | "vertical";
  separatorAfter?: ReadonlyArray<number>;
}) {
  if (!payload?.length) return null;
  const sep = new Set(separatorAfter ?? []);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < payload.length; i++) {
    const entry = payload[i];
    if (!entry) continue;
    items.push(
      <Item key={i} style={{ color: entry.color }}>
        {entry.type === "rect" ? (
          <svg width={14} height={14} aria-hidden="true">
            <rect x={1} y={2} width={12} height={10} fill={entry.color} />
          </svg>
        ) : (
          <svg width={28} height={14} aria-hidden="true">
            <line
              x1={1}
              y1={7}
              x2={27}
              y2={7}
              stroke={entry.color}
              strokeWidth={2}
              strokeDasharray={dashOf(entry)}
            />
          </svg>
        )}
        {entry.value}
      </Item>,
    );
    if (sep.has(i)) {
      items.push(
        <SeparatorItem key={`sep-${i}`} role="separator" aria-hidden="true" />,
      );
    }
  }
  return <List $vertical={layout === "vertical"}>{items}</List>;
}

"use client";

import styled, { css } from "styled-components";
import type { BriefNote } from "@/lib/insights/monthBrief";

// The strip under the headline: the month's bottom line as a big figure, then
// the brief's notes as short columns, each led in claret like a news brief.
const Strip = styled.section`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: 220px repeat(3, minmax(0, 1fr));
    gap: ${theme.spacing["2xl"]};
    padding: ${theme.spacing.lg} 0 ${theme.spacing.xl};
    margin-bottom: ${theme.spacing.xl};
    border-top: 1px solid ${theme.colors.ink};
    border-bottom: 1px solid ${theme.colors.hairlineStrong};

    @media (max-width: 991px) {
      grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 767px) {
      grid-template-columns: 1fr;
      gap: ${theme.spacing.lg};
    }
  `}
`;

const Figure = styled.div`
  ${({ theme }) => css`
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    letter-spacing: ${theme.typography.kicker.letterSpacing};
    text-transform: uppercase;
    color: ${theme.colors.body};
  `}
`;

const FigureValue = styled.div<{ $short: boolean }>`
  ${({ theme, $short }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: 40px;
    font-weight: 700;
    line-height: 1.1;
    margin-top: ${theme.spacing.xs};
    color: ${$short ? theme.colors.negative : theme.colors.positive};
    font-variant-numeric: tabular-nums;
  `}
`;

const FigureNote = styled.div`
  ${({ theme }) => css`
    font-size: 13px;
    color: ${theme.colors.body};
    margin-top: ${theme.spacing.xs};
  `}
`;

const Note = styled.p`
  ${({ theme }) => css`
    font-size: 15px;
    line-height: 1.5;
    color: ${theme.colors.ink};

    b {
      color: ${theme.colors.accent};
      font-weight: 700;
    }
  `}
`;

export function MonthBriefPanel({
  leftOver,
  planned,
  fmt,
  notes,
}: {
  leftOver: number;
  planned: number;
  fmt: (n: number) => string;
  notes: BriefNote[];
}) {
  const isShort = leftOver < 0;
  return (
    <Strip aria-label="The month in brief">
      <div>
        <Figure>{isShort ? "Short" : "Left over"}</Figure>
        <FigureValue $short={isShort}>{fmt(Math.abs(leftOver))}</FigureValue>
        <FigureNote>{fmt(planned)} planned</FigureNote>
      </div>
      {notes.map((note) => (
        <Note key={note.lead}>
          <b>{note.lead}</b> {note.body}
        </Note>
      ))}
    </Strip>
  );
}

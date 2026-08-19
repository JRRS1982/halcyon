"use client";

import type { Checklist } from "@/lib/dashboard/checklist";
import Link from "next/link";
import styled, { css } from "styled-components";

// The monthly loop, as state: which stages of this month are done and where
// to go for the ones that aren't. Same hairline chrome as the summary tiles
// so it reads as part of the page, not a banner.
const Card = styled.section`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.lg};
    margin-top: ${theme.spacing["2xl"]};
  `}
`;

const Header = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

const Items = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing["2xl"]}`};

  @media (max-width: 767px) {
    flex-direction: column;
  }
`;

const Item = styled.li`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
  `}
`;

// Done gets the status-pip green dot; outstanding gets a hollow ring so the
// difference survives without colour vision.
const Dot = styled.span<{ $done: boolean }>`
  ${({ theme, $done }) => css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: ${theme.rounded.full};
    background: ${$done ? theme.colors.positive : "transparent"};
    border: 1px solid ${$done ? theme.colors.positive : theme.colors.bodyMuted};
  `}
`;

const DoneLabel = styled.span`
  color: ${({ theme }) => theme.colors.body};
`;

// Outstanding stages are the interaction on this card, so they take the
// accent — the sanctioned colour for "this responds to you".
const TodoLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const AllDone = styled.span`
  color: ${({ theme }) => theme.colors.body};
`;

type MonthChecklistProps = {
  checklist: Checklist;
  monthLabel: string;
};

export function MonthChecklist({ checklist, monthLabel }: MonthChecklistProps) {
  return (
    <Card aria-label={`This month · ${monthLabel}`}>
      <Header>
        This month · {monthLabel}
        {checklist.complete ? " · All caught up" : ""}
      </Header>
      <Items>
        {checklist.items.map((item) => (
          <Item key={item.key}>
            <Dot $done={item.done} aria-hidden />
            {item.done ? (
              <DoneLabel>{item.label}</DoneLabel>
            ) : (
              <TodoLink href={item.href}>{item.label}</TodoLink>
            )}
          </Item>
        ))}
      </Items>
    </Card>
  );
}
